/**
 * ANP_AP2 Utility Functions - v1.0a
 *
 * Hash computation utilities for ANP_AP2 protocol.
 * All hashes use: b64url(sha256(JCS(content)))
 */

import { createHash } from "crypto";
import type { CartContents, PaymentMandateContents } from "./types/index.js";

/**
 * Canonical JSON Serialization (RFC 8785)
 *
 * Ensures consistent JSON representation for hashing.
 * In production, consider using a library like `canonicalize`.
 */
export function jcs(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/**
 * SHA-256 hash with Base64URL encoding
 */
export function sha256B64Url(data: string): string {
  const hash = createHash("sha256").update(data, "utf8").digest();
  return hash.toString("base64url");
}

/**
 * Compute cart_hash
 *
 * Formula: b64url(sha256(JCS(CartContents)))
 *
 * @example
 * ```typescript
 * const hash = cartHash(cartContents);
 * // "X4fPQ9mK..."
 * ```
 */
export function cartHash(contents: CartContents): string {
  const canonical = jcs(contents);
  return sha256B64Url(canonical);
}

/**
 * Compute pmt_hash
 *
 * Formula: b64url(sha256(JCS(PaymentMandateContents)))
 *
 * @example
 * ```typescript
 * const hash = paymentMandateHash(pmtContents);
 * // "Y7gQR2nL..."
 * ```
 */
export function paymentMandateHash(contents: PaymentMandateContents): string {
  const canonical = jcs(contents);
  return sha256B64Url(canonical);
}

/**
 * Compute cred_hash (for webhook credentials)
 *
 * Formula: b64url(sha256(JCS(contents)))
 *
 * Works for both PaymentReceiptContents and FulfillmentReceiptContents.
 *
 * @example
 * ```typescript
 * const hash = contentHash(paymentReceiptContents);
 * // "Z8hRS3oM..."
 * ```
 */
export function contentHash(contents: unknown): string {
  const canonical = jcs(contents);
  return sha256B64Url(canonical);
}
