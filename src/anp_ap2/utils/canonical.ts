import canonicalize from "canonicalize";

import { sha256 as coreSha256 } from "@/core/hash.js";
import { base64urlEncode } from "@/core/utils.js";

/**
 * Performs JSON Canonical Serialization (JCS) on data.
 *
 * JCS ensures consistent JSON serialization regardless of key order,
 * which is critical for hash computation and signature verification.
 *
 * @param data - Any JSON-serializable data
 * @returns Canonically serialized JSON string
 *
 * @example
 * ```typescript
 * import { jcs } from "anp-ts";
 *
 * const obj1 = { b: 2, a: 1 };
 * const obj2 = { a: 1, b: 2 };
 * console.log(jcs(obj1) === jcs(obj2)); // true - same canonical form
 * ```
 */
export function jcs(data: unknown): string {
  return (canonicalize as unknown as (value: unknown) => string)(data);
}

/**
 * Computes SHA-256 hash and encodes as base64url.
 *
 * @param data - Data to hash (string or bytes)
 * @returns Base64url-encoded hash
 *
 * @example
 * ```typescript
 * import { sha256B64Url } from "anp-ts";
 *
 * const hash = sha256B64Url("Hello, World!");
 * console.log(hash); // "8ZzI_1gYpFfKfYxd5UOelQTjxvG8Lq5YSvOg6fUfJik"
 * ```
 */
export function sha256B64Url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = coreSha256(bytes);
  return base64urlEncode(digest);
}

/**
 * Computes the canonical hash of cart contents.
 *
 * This hash is used to link cart mandates with payment mandates,
 * ensuring the user is paying for the exact cart they authorized.
 *
 * The hash is computed as: SHA256(JCS(contents)) encoded as base64url.
 *
 * @param contents - Cart contents to hash
 * @returns Base64url-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * import { ap2 } from "anp-ts";
 *
 * const cartContents = {
 *   id: "cart-001",
 *   user_signature_required: false,
 *   payment_request: { /* ... *\/ }
 * };
 *
 * const hash = ap2.utils.cartHash(cartContents);
 * // Use this hash when creating payment mandate
 * const paymentMandate = await paymentBuilder.build(paymentContents, hash);
 * ```
 */
export function cartHash(contents: unknown): string {
  return sha256B64Url(new TextEncoder().encode(jcs(contents)));
}


