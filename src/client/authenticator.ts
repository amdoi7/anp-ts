/**
 * DID-WBA Authenticator
 * 
 * Creates DID-WBA signatures for HTTP requests.
 * Fail Fast: No defensive programming, errors thrown immediately.
 * 
 * @packageDocumentation
 */

import { signSecp256k1 } from "../core/crypto.js";
import { base64urlEncode } from "../core/utils.js";
import canonicalizeModule from "canonicalize";
import type { JsonWebKey } from "crypto";

const canonicalize =
  (typeof canonicalizeModule === "function"
    ? canonicalizeModule
    : (canonicalizeModule as { default?: (value: unknown) => string | undefined }).default) ??
  ((value: unknown) => JSON.stringify(value));

export interface AuthenticatorConfig {
  /** DID identifier */
  did: string;
  /** Private key in JWK format (secp256k1) */
  privateKey: JsonWebKey;
  /** Optional cache for signatures */
  cache?: Map<string, string>;
}

/**
 * Authenticator for creating DID-WBA signatures
 * 
 * @example
 * ```typescript
 * const auth = new Authenticator({
 *   did: "did:wba:example.com",
 *   privateKey: keyPair.privateKey
 * });
 * 
 * const authHeader = await auth.createAuthHeader("POST", "/api/orders", requestBody);
 * // DidWba did="...", sig="...", ts="..."
 * ```
 */
export class Authenticator {
  private readonly did: string;
  private readonly privateKey: JsonWebKey;
  private readonly cache: Map<string, string>;
  private readonly verificationMethod: string;

  constructor(config: AuthenticatorConfig) {
    this.did = config.did;
    this.privateKey = config.privateKey;
    this.cache = config.cache ?? new Map();
    this.verificationMethod = `${config.did}#key-0`;
  }

  /**
   * Create authorization header for HTTP request
   * 
   * Fail Fast: Throws if signing fails, no error wrapping.
   * 
   * @param method - HTTP method
   * @param url - Request URL
   * @param body - Request body (optional)
   * @returns Authorization header value
   */
  async createAuthHeader(
    method: string,
    url: string,
    body?: unknown
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const cacheKey = `${method}:${url}:${timestamp}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Create message to sign
    const message = {
      method: method.toUpperCase(),
      url,
      timestamp,
      body: body ?? null,
    };

    // Canonicalize (throws if fails)
    const canonical = canonicalize(message);
    if (!canonical) {
      throw new Error("Failed to canonicalize message");
    }

    // Hash message
    const messageBytes = new TextEncoder().encode(canonical);
    
    // Sign (throws if fails)
    const signature = await signSecp256k1(this.privateKey, messageBytes);
    const sig = base64urlEncode(signature);

    // Create header
    const header = `DidWba did="${this.did}", sig="${sig}", ts="${timestamp}"`;

    // Cache result
    this.cache.set(cacheKey, header);

    return header;
  }

  /**
   * Sign HTTP request (alias for createAuthHeader)
   */
  async signHttpRequest(
    method: string,
    url: string,
    body?: unknown
  ): Promise<string> {
    return this.createAuthHeader(method, url, body);
  }

  /**
   * Get the DID
   */
  getDid(): string {
    return this.did;
  }

  /**
   * Get the verification method
   */
  getVerificationMethod(): string {
    return this.verificationMethod;
  }
}

/**
 * Create an authenticator instance
 * 
 * @example
 * ```typescript
 * const auth = createAuthenticator({
 *   did: "did:wba:example.com",
 *   privateKey: keyPair.privateKey
 * });
 * ```
 */
export function createAuthenticator(config: AuthenticatorConfig): Authenticator {
  return new Authenticator(config);
}
