import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";

/**
 * Thin wrapper around the noble SHA-256 implementation to keep a single import site.
 */
export const sha256 = nobleSha256;

export type Sha256 = typeof sha256;


