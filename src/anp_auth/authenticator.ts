import type { LruCacheLike } from "@/core/utils.js";
import type { HttpMethod } from "@/core/http.js";
import { signSecp256k1 } from "@/core/crypto.js";
import { createDidDocument } from "@/core/did.js";
import { base64urlEncode } from "@/core/utils.js";
import { z } from "zod";
import canonicalize from "canonicalize";
import { AuthenticatorError } from "./errors.js";
import type { JsonWebKey } from "crypto";
import { LogManager, NullLogger } from "@/core/logging.js";

/**
 * Initialization options for the Authenticator.
 */
export interface AuthenticatorInit {
  /** The Decentralized Identifier (DID). */
  did: string;
  /** The private key in JWK format. Must be a secp256k1 key. */
  privateKey: JsonWebKey;
  /** An optional cache for storing authorization headers. Defaults to an in-memory cache. */
  cache?: LruCacheLike<string, string>;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

const JwkSecp256k1PrivateSchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("secp256k1"),
    x: z.string().min(1),
    y: z.string().min(1),
    d: z.string().min(1),
  })
  .loose();

const LruCacheLikeSchema = z.custom<LruCacheLike<string, string>>((val) => {
  return (
    !!val &&
    typeof (val as any).get === "function" &&
    typeof (val as any).set === "function" &&
    typeof (val as any).has === "function"
  );
});

const AuthenticatorInitSchema = z
  .object({
    did: z.string().min(1),
    privateKey: JwkSecp256k1PrivateSchema,
    cache: LruCacheLikeSchema.optional(),
    logger: z.instanceof(LogManager).optional(),
  })
  .strict();

/**
 * Defines the public API for the Authenticator.
 */
export interface AuthenticatorApi {
  /**
   * Creates a DIDWba Authorization header for a given request.
   * @param url - The URL of the request.
   * @param method - The HTTP method of the request.
   * @returns A promise that resolves to the Authorization header string.
   */
  createAuthorizationHeader(url: string, method: HttpMethod): Promise<string>;
}

class InMemoryCache implements LruCacheLike<string, string> {
  private map = new Map<string, { value: string; expiresAt?: number }>();
  get(key: string): string | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt && hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: string, options?: { ttl?: number }): void {
    const expiresAt = options?.ttl ? Date.now() + options.ttl : undefined;
    const entry: { value: string; expiresAt?: number } = { value };
    if (expiresAt !== undefined) entry.expiresAt = expiresAt;
    this.map.set(key, entry);
  }
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

/**
 * The Authenticator class is responsible for creating DID-WBA signatures and headers.
 */
export class Authenticator implements AuthenticatorApi {
  private did: string;
  private privateKey: JsonWebKey;
  private cache: LruCacheLike<string, string>;
  private verificationMethod: string;
  private readonly logger: LogManager;

  /**
   * The constructor is private. Use Authenticator.init() to create an instance.
   * @param init - The initialization options.
   */
  private constructor(init: AuthenticatorInit) {
    const parsedInit = AuthenticatorInitSchema.parse(init);
    this.did = parsedInit.did;
    // The type assertion is a pragmatic choice as Zod's inferred type is structurally
    // compatible but not nominally identical to the JsonWebKey interface.
    this.privateKey = parsedInit.privateKey as unknown as JsonWebKey;
    this.cache = parsedInit.cache ?? new InMemoryCache();
    const doc = createDidDocument(this.privateKey);
    this.verificationMethod = `${doc.id}#keys-1`;

    this.logger = (init.logger ?? new LogManager(new NullLogger())).withContext({ module: "Authenticator" });
    this.logger.info("Authenticator initialized");
  }

  /**
   * Creates and initializes a new Authenticator instance.
   * @param init - The initialization options.
   * @returns A new Authenticator instance.
   * @throws {AuthenticatorError} if initialization fails.
   */
  static init(init: AuthenticatorInit): Authenticator {
    try {
      return new Authenticator(init);
    } catch (error: any) {
      const tempLogger = (init.logger ?? new LogManager(new NullLogger())).withContext({ module: "Authenticator" });
      tempLogger.error("Authenticator initialization failed", error);
      throw new AuthenticatorError(`Initialization failed: ${error?.message ?? String(error)}`);
    }
  }

  /**
   * Creates a DIDWba Authorization header for a given request.
   * This is an alias for signRequest.
   * @param url - The URL of the request.
   * @param method - The HTTP method of the request.
   * @returns A promise that resolves to the Authorization header string.
   */
  async createAuthorizationHeader(url: string, method: HttpMethod): Promise<string> {
    return this.signRequest(url, method);
  }

  /**
   * Signs a request and returns the full DIDWba Authorization header.
   * @param url - The URL of the request.
   * @param method - The HTTP method of the request.
   * @returns A promise that resolves to the Authorization header string.
   * @internal
   */
  async signRequest(url: string, method: HttpMethod): Promise<string> {
    this.logger.debug("Signing request", { url, method });
    const cacheKey = `${method} ${url}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug("Returning cached authorization header", { url, method });
      return cached;
    }
    const urlObj = new URL(url);
    const service = urlObj.host;
    const nonce = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const timestamp = new Date().toISOString();
    // Build payload same as Go: {nonce, timestamp, service, did}
    const payload = {
      nonce,
      timestamp,
      service,
      did: this.did,
    } as const;
    // The 'canonicalize' library may not have official TypeScript types.
    const canonical = (canonicalize as unknown as (v: unknown) => string)(payload);
    try {
      const sigBytes = await signSecp256k1(
        this.privateKey,
        new TextEncoder().encode(canonical)
      );
      const signature = base64urlEncode(sigBytes);
      const header = `DIDWba: did="${this.did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="${this.verificationMethod}", signature="${signature}"`;
      this.cache.set(cacheKey, header, { ttl: 30_000 });
      this.logger.info("Authorization header created and cached", { url, method });
      return header;
    } catch (error: any) {
      this.logger.error("Failed to sign request", error, { url, method });
      throw new AuthenticatorError(`Failed to sign request: ${error?.message ?? String(error)}`);
    }
  }
}

