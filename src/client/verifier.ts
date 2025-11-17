/**
 * DID-WBA Verifier
 *
 * Verifies DID-WBA signatures on HTTP requests.
 * Fail Fast: Errors thrown immediately, no defensive programming.
 *
 * @packageDocumentation
 */

import canonicalizeModule from "canonicalize";
import { verifySecp256k1Signature } from "../core/crypto.js";
import { resolveDidDocument, type DidDocument } from "../core/did.js";
import { defaultHttpClient, type HttpClient } from "../core/http.js";

export interface VerifierConfig {
  /** Optional HTTP client for DID resolution */
  httpClient?: HttpClient;
  /** Optional DID document cache */
  cache?: Map<string, DidDocument>;
}

export interface VerifyOptions {
  method: string;
  url: string;
  body?: unknown;
  /** Optional: provide DID document directly (skip resolution) */
  didDocument?: DidDocument;
}

export interface VerificationResult {
  verified: boolean;
  did?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Verifier for DID-WBA signatures
 *
 * @example
 * ```typescript
 * const verifier = new Verifier();
 *
 * const result = await verifier.verify(authHeader, {
 *   method: "POST",
 *   url: "/api/orders",
 *   body: requestBody
 * });
 *
 * if (result.verified) {
 *   console.log("Signature valid from:", result.did);
 * }
 * ```
 */
const canonicalizeFn =
  (typeof canonicalizeModule === "function"
    ? canonicalizeModule
    : (canonicalizeModule as { default?: (value: unknown) => string }).default) ??
  ((value: unknown) => JSON.stringify(value));

export class Verifier {
  private readonly httpClient: HttpClient;
  private readonly cache: Map<string, DidDocument>;

  constructor(config: VerifierConfig = {}) {
    this.httpClient = config.httpClient ?? defaultHttpClient;
    this.cache = config.cache ?? new Map();
  }

  /**
   * Verify DID-WBA signature
   *
   * Fail Fast: Throws on parsing errors, returns VerificationResult for signature validation.
   *
   * @param authHeader - Authorization header value
   * @param options - Verification options
   * @returns Verification result
   */
  async verify(
    authHeader: string,
    options: VerifyOptions
  ): Promise<VerificationResult> {
    try {
      // Parse header (throws if invalid format)
      const parsed = this.parseAuthHeader(authHeader);
      if (!parsed) {
        return { verified: false, error: "Invalid authorization header format" };
      }

      const { did, sig, ts } = parsed;

      // Get DID document
      let didDoc = options.didDocument;
      if (!didDoc) {
        // Check cache
        didDoc = this.cache.get(did);

        if (!didDoc) {
          // Resolve DID (throws if resolution fails)
          didDoc = await resolveDidDocument(did, this.httpClient);
          this.cache.set(did, didDoc);
        }
      }

      // Get public key from DID document
      const publicKey = this.extractPublicKey(didDoc);
      if (!publicKey) {
        return { verified: false, error: "Public key not found in DID document" };
      }

      // Reconstruct message
      const message = {
        method: options.method.toUpperCase(),
        url: options.url,
        timestamp: ts,
        body: options.body ?? null,
      };

      // Canonicalize (throws if fails)
      const canonical = canonicalizeFn(message);
      if (!canonical) {
        return { verified: false, error: "Failed to canonicalize message" };
      }

      // Verify signature
      const messageBytes = new TextEncoder().encode(canonical);

      const valid = await verifySecp256k1Signature(
        publicKey,
        messageBytes,
        sig
      );

      if (valid) {
        return { verified: true, did, timestamp: ts };
      } else {
        return { verified: false, error: "Signature verification failed" };
      }
    } catch (error) {
      // Fail Fast: Let unexpected errors propagate
      throw error;
    }
  }

  /**
   * Parse authorization header
   */
  private parseAuthHeader(header: string): { did: string; sig: string; ts: string } | null {
    const regex = /DidWba\s+did="([^"]+)",\s*sig="([^"]+)",\s*ts="([^"]+)"/;
    const match = header.match(regex);

    if (!match) {
      return null;
    }

    const [, did, sig, ts] = match;
    if (!did || !sig || !ts) {
      return null;
    }

    return { did, sig, ts };
  }

  /**
   * Extract public key from DID document
   */
  private extractPublicKey(didDoc: DidDocument): JsonWebKey | null {
    // Get first verification method
    const vm = didDoc.verificationMethod?.[0];
    if (!vm) {
      return null;
    }

    return vm.publicKeyJwk ?? null;
  }
}

/**
 * Create a verifier instance
 */
export function createVerifier(config?: VerifierConfig): Verifier {
  return new Verifier(config);
}
