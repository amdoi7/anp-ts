export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleaned.length % 2 !== 0) throw new Error("Invalid hex string length");
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byteStr = cleaned.slice(i * 2, i * 2 + 2);
    const value = parseInt(byteStr, 16);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid hex data at position ${i * 2}: '${byteStr}'`);
    }
    out[i] = value;
  }
  return out;
}

export function base64urlEncode(bytes: Uint8Array): string {
  const G: any = globalThis as any;
  if (typeof G.Buffer !== "undefined") {
    const b64 = G.Buffer.from(bytes).toString("base64");
    return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  // Fallback to building a binary string and using btoa
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk as unknown as number[]);
  }
  const b64 = btoa(binary);
  return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function base64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = (input + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP: Record<string, number> = Object.fromEntries(
  [...BASE58_ALPHABET].map((c, i) => [c, i])
);

export function toBase58(bytes: Uint8Array): string {
  // BigInt-based implementation
  let zeros = 0;
  for (const b of bytes) {
    if (b === 0) zeros++;
    else break;
  }
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  let encoded = "";
  while (value > 0n) {
    const rem = Number(value % 58n);
    value = value / 58n;
    encoded = BASE58_ALPHABET[rem] + encoded;
  }
  if (encoded.length === 0 && zeros > 0) {
    // All zeros
    return "1".repeat(zeros);
  }
  return "1".repeat(zeros) + encoded;
}

export function fromBase58(s: string): Uint8Array {
  if (s.length === 0) return new Uint8Array();
  let zeros = 0;
  for (const c of s) {
    if (c === "1") zeros++;
    else break;
  }
  let value = 0n;
  for (const c of s) {
    const v = BASE58_MAP[c];
    if (v === undefined) throw new Error("Invalid base58 character");
    value = value * 58n + BigInt(v);
  }
  // Convert BigInt to bytes
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < zeros; i++) out[i] = 0;
  for (let i = 0; i < bytes.length; i++) out[zeros + i] = bytes[i] as number;
  return out;
}

export interface LruCacheLike<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, options?: { ttl?: number }): void;
  has(key: K): boolean;
}

