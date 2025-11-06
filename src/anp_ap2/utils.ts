import canonicalize from "canonicalize";
import { sha256 as nobleSha256 } from "@noble/hashes/sha256";
import { base64urlEncode } from "@/core/utils.js";

/**
 * Produces a canonical JSON string representation of the input data.
 * This is used for creating consistent hashes.
 * @param data - The data to canonicalize.
 * @returns A canonical JSON string.
 * @internal
 */
export function jcs(data: unknown): string {
  // The 'canonicalize' library may not have official TypeScript types,
  // requiring this type assertion.
  return (canonicalize as unknown as (v: unknown) => string)(data);
}

/**
 * Computes the SHA-256 hash of the input data and encodes it as a Base64URL string.
 * @param data - The data to hash, as a string or Uint8Array.
 * @returns The Base64URL-encoded hash.
 * @internal
 */
export function sha256B64Url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = nobleSha256(bytes);
  return base64urlEncode(digest);
}

/**
 * Computes the hash of cart contents using JCS and SHA-256.
 * @param contents - The cart contents object.
 * @returns The Base64URL-encoded hash of the cart contents.
 * @internal
 */
export function cartHash(contents: unknown): string {
  return sha256B64Url(new TextEncoder().encode(jcs(contents)));
}


