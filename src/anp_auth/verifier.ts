import canonicalize from "canonicalize";
import { verifyJwt } from "@/core/jwt.js";
import { resolveDidDocument } from "@/core/did.js";
import { verifySecp256k1Signature } from "@/core/crypto.js";
import { z } from "zod";
import { VerifierError } from "./errors.js";
import type { JsonWebKey } from "crypto";
import { LogManager, NullLogger } from "@/core/logging.js";

// Accept 5 minutes clock skew
const TIMESTAMP_MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * Options for configuring the Verifier.
 */
export interface VerifierOptions {
  /** The secret key for verifying JWTs. */
  jwtSecret: string;
  /** An optional store for checking nonce uniqueness to prevent replay attacks. */
  nonceStore?: {
    has(nonce: string): Promise<boolean> | boolean;
    set(nonce: string, ttlMs: number): Promise<void> | void;
  };
  /** The time-to-live for JWTs issued by the verifier, in milliseconds. Defaults to 15 minutes. */
  tokenTtlMs?: number;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

const VerifierOptionsSchema = z
  .object({
    jwtSecret: z.string().min(1),
    nonceStore: z
      .object({
        has: z.custom<(nonce: string) => boolean | Promise<boolean>>(),
        set: z.custom<(nonce: string, ttlMs: number) => void | Promise<void>>(),
      })
      .optional(),
    tokenTtlMs: z.number().positive().optional(),
    logger: z.instanceof(LogManager).optional(),
  })
  .strict();

// --- Verification Result Types ---

/**
 * Represents a successful verification.
 */
export type VerificationSuccess = {
  valid: true;
  did: string;
};

/**
 * Represents a failed verification.
 */
export type VerificationFailure = {
  valid: false;
  error: VerifierError;
};

/**
 * The result of a verification attempt.
 */
export type VerificationResult = VerificationSuccess | VerificationFailure;

/**
 * Verifies DID-WBA and JWT Bearer authentication headers.
 */
export class Verifier {
  private jwtSecret: Uint8Array;
  private nonceStore?: VerifierOptions["nonceStore"];
  private tokenTtlMs: number;
  private readonly logger: LogManager;

  constructor(opts: VerifierOptions) {
    const parsed = VerifierOptionsSchema.parse(opts);
    this.jwtSecret = new TextEncoder().encode(parsed.jwtSecret);
    this.nonceStore = parsed.nonceStore;
    this.tokenTtlMs = parsed.tokenTtlMs ?? 15 * 60 * 1000;

    this.logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "Verifier" });
    this.logger.info("Verifier initialized");
  }

  private verifyTimestamp(ts: string): boolean {
    const t = parseRfc3339(ts);
    if (t === null) return false;
    const now = Date.now();
    return Math.abs(now - t) <= TIMESTAMP_MAX_SKEW_MS;
  }

  /**
   * Verifies an authentication header from a request.
   * Supports `Bearer <jwt>` and `DIDWba <signature>`.
   * @param req - The request object containing headers.
   * @returns A promise that resolves to a VerificationResult.
   */
  async verifyRequest(req: { headers: Record<string, string | undefined> }): Promise<VerificationResult> {
    this.logger.debug("Starting request verification", { host: req.headers["host"] });
    const auth = req.headers["authorization"] || req.headers["Authorization"];
    if (!auth) {
      this.logger.warn("Verification failed: Missing Authorization header");
      return { valid: false, error: new VerifierError("Missing Authorization header", "missing_header") };
    }

    if (auth.startsWith("Bearer ")) {
      this.logger.debug("Attempting JWT Bearer token verification");
      const token = auth.slice("Bearer ".length);
      try {
        const res = await verifyJwt(token, this.jwtSecret);
        const did = typeof res.payload.sub === "string" ? res.payload.sub : undefined;
        if (!did) {
          this.logger.warn("JWT verification failed: 'sub' field missing", { payload: res.payload });
          return { valid: false, error: new VerifierError("JWT 'sub' field is missing or invalid", "invalid_jwt_sub") };
        }
        this.logger.info("JWT verification successful", { did });
        return { valid: true, did };
      } catch (e: any) {
        this.logger.error("JWT verification threw an exception", e);
        return { valid: false, error: new VerifierError(`JWT verification failed: ${e.message}`, "invalid_jwt") };
      }
    }

    if (auth.startsWith("DIDWba:")) {
      this.logger.debug("Attempting DIDWba header verification");
      const host = String(req.headers["host"] || req.headers["x-forwarded-host"] || "");
      if (!host) {
        this.logger.warn("DIDWba verification failed: Missing Host header");
        return { valid: false, error: new VerifierError("Missing Host header", "missing_host") };
      }
      return this.verifyDidWbaHeader(auth, host);
    }

    this.logger.warn("Verification failed: Unsupported Authorization scheme", { scheme: auth.split(" ")[0] });
    return { valid: false, error: new VerifierError("Unsupported Authorization scheme", "unsupported_scheme") };
  }

  /**
   * Verifies a DIDWba authentication header.
   * @param header - The full `DIDWba` authorization header string.
   * @param serviceDomain - The domain of the service being accessed, extracted from the Host header.
   * @returns A promise that resolves to a VerificationResult.
   */
  async verifyDidWbaHeader(header: string, serviceDomain: string): Promise<VerificationResult> {
    const parsed = parseAuthHeader(header);
    if (!parsed) {
      this.logger.warn("Failed to parse DIDWba header");
      return { valid: false, error: new VerifierError("Invalid DIDWba header format", "invalid_header_format") };
    }

    const context = { did: parsed.did, nonce: parsed.nonce, serviceDomain };
    this.logger.debug("Verifying DIDWba header fields", context);

    if (!this.verifyTimestamp(parsed.timestamp)) {
      this.logger.warn("Timestamp verification failed", { ...context, timestamp: parsed.timestamp });
      return { valid: false, error: new VerifierError("Timestamp is expired or invalid", "invalid_timestamp") };
    }

    if (this.nonceStore) {
      const key = `${parsed.did}:${parsed.nonce}`;
      const used = await this.nonceStore.has(key);
      if (used) {
        this.logger.warn("Nonce re-use detected", context);
        return { valid: false, error: new VerifierError("Nonce has already been used", "nonce_reused") };
      }
      await this.nonceStore.set(key, 5 * 60 * 1000);
    }

    try {
      const didDoc = await resolveDidDocument(parsed.did);
      this.logger.debug("Successfully resolved DID document", { ...context, didDocId: didDoc.id });
      const vm = didDoc.verificationMethod.find((m) => {
        const frag = m.id.split("#").pop() || "";
        return `${didDoc.id}#${frag}` === parsed.verification_method || m.id === parsed.verification_method;
      });

      if (!vm || (vm.type !== "EcdsaSecp256k1VerificationKey2019" && vm.type !== "EcdsaSecp256k1VerificationKey2020")) {
        this.logger.warn("No suitable verification method found in DID Document", { ...context, verificationMethod: parsed.verification_method });
        return { valid: false, error: new VerifierError("No suitable verification method found in DID Document", "vm_not_found") };
      }
      this.logger.debug("Found matching verification method", { ...context, vmId: vm.id });

      const payload = { nonce: parsed.nonce, timestamp: parsed.timestamp, service: serviceDomain, did: parsed.did };
      const canonical = (canonicalize as unknown as (v: unknown) => string)(payload);

      const ok = await verifySecp256k1Signature(vm.publicKeyJwk as JsonWebKey, new TextEncoder().encode(canonical), parsed.signature);

      if (ok) {
        this.logger.info("DIDWba signature verification successful", context);
        return { valid: true, did: parsed.did };
      } else {
        this.logger.warn("DIDWba signature verification failed", context);
        return { valid: false, error: new VerifierError("Invalid signature", "invalid_signature") };
      }
    } catch (e: any) {
      this.logger.error("An unexpected error occurred during DIDWba verification", e, context);
      return { valid: false, error: new VerifierError(e.message, "verification_failed") };
    }
  }
}

/**
 * A factory function to create a new Verifier instance.
 * @param opts - The options for the verifier.
 * @returns A new Verifier instance.
 */
export function createVerifier(opts: VerifierOptions): Verifier {
  return new Verifier(opts);
}

const DidWbaHeaderSchema = z
  .object({
    did: z.string().min(1),
    nonce: z.string().min(1),
    timestamp: z.string().min(1),
    verification_method: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

function parseAuthHeader(header: string): z.infer<typeof DidWbaHeaderSchema> | null {
  const trimmed = header.trim();
  if (!trimmed.startsWith("DIDWba ")) return null;
  const rest = trimmed.slice("DIDWba ".length);

  const out: Record<string, string> = {};
  const parts = rest.split(",").map((p) => p.trim());

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;

    const key = part.slice(0, eqIndex).trim();
    let value = part.slice(eqIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  try {
    return DidWbaHeaderSchema.parse(out);
  } catch {
    return null;
  }
}

function parseRfc3339(ts: string): number | null {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? null : t;
}

