import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha256";
import { base64urlDecode, base64urlEncode } from "@/core/utils.js";

export interface KeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export async function generateSecp256k1KeyPair(): Promise<KeyPair> {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, false); // uncompressed: 0x04 + X + Y
  const d = base64urlEncode(priv);
  const x = base64urlEncode(pub.slice(1, 33));
  const y = base64urlEncode(pub.slice(33, 65));
  return {
    publicKeyJwk: { kty: "EC", crv: "secp256k1", x, y },
    privateKeyJwk: { kty: "EC", crv: "secp256k1", x, y, d },
  };
}

export async function signSecp256k1(
  privateKey: JsonWebKey,
  data: Uint8Array
): Promise<Uint8Array> {
  if (!privateKey.d) throw new Error("Private JWK missing 'd'");
  const digest = sha256(data);
  const priv = base64urlDecode(privateKey.d);
  const sig = secp256k1.sign(digest, priv, { der: false }); // 64-byte compact
  return new Uint8Array(sig);
}

export function sha256(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
}

// Note: If DER parsing is needed, prefer noble:
// const raw = secp256k1.Signature.fromDER(der).toCompactRawBytes();

export function jwkToRawSecp256k1PublicKey(jwk: JsonWebKey): Uint8Array {
  if (!jwk.x || !jwk.y) throw new Error("JWK missing x/y");
  const x = base64urlDecode(jwk.x);
  const y = base64urlDecode(jwk.y);
  const uncompressed = new Uint8Array(1 + x.length + y.length);
  uncompressed[0] = 0x04;
  uncompressed.set(x, 1);
  uncompressed.set(y, 1 + x.length);
  return uncompressed;
}

export async function verifySecp256k1Signature(
  publicJwk: JsonWebKey,
  payload: Uint8Array,
  signatureB64Url: string
): Promise<boolean> {
  const digest = sha256(payload);
  const signature = base64urlDecode(signatureB64Url);
  const publicKey = jwkToRawSecp256k1PublicKey(publicJwk);
  return secp256k1.verify(signature, digest, publicKey, { strict: true });
}

// ---- PEM (EC PRIVATE KEY) support ----

function readASN1Length(buf: Uint8Array, offset: number): { length: number; next: number } {
  let o = offset;
  let len = buf[o++];
  if (len === undefined) throw new Error("ASN.1 length out of range");
  if (len & 0x80) {
    const numBytes = len & 0x7f;
    len = 0;
    for (let i = 0; i < numBytes; i++) {
      const b = buf[o++];
      if (b === undefined) throw new Error("ASN.1 length overflow");
      len = (len << 8) | b;
    }
  }
  return { length: len, next: o };
}

export function importSecp256k1PrivateKeyFromPem(pem: string): JsonWebKey {
  // PKCS#8 ONLY: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----
  if (!/-----BEGIN PRIVATE KEY-----/.test(pem)) {
    throw new Error("Only PKCS#8 'BEGIN PRIVATE KEY' is supported");
  }
  const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const der = new Uint8Array(binary.length);
  for (let k = 0; k < binary.length; k++) der[k] = binary.charCodeAt(k);

  let i = 0;
  // PrivateKeyInfo ::= SEQUENCE
  if (der[i++] !== 0x30) throw new Error("Invalid PKCS#8: missing sequence");
  let lr = readASN1Length(der, i); i = lr.next;
  // version INTEGER (0)
  if (der[i++] !== 0x02) throw new Error("Invalid PKCS#8: missing version");
  const verLen = readASN1Length(der, i); i = verLen.next + verLen.length;
  // AlgorithmIdentifier SEQUENCE
  if (der[i++] !== 0x30) throw new Error("Invalid PKCS#8: missing AlgorithmIdentifier");
  const algLen = readASN1Length(der, i); i = algLen.next + algLen.length;
  // privateKey OCTET STRING
  if (der[i++] !== 0x04) throw new Error("Invalid PKCS#8: missing privateKey octet string");
  const pkLen = readASN1Length(der, i); i = pkLen.next;
  const pkcs8Priv = der.slice(i, i + pkLen.length);

  // inner ECPrivateKey (SEC1) structure
  let j = 0;
  if (pkcs8Priv[j++] !== 0x30) throw new Error("Invalid PKCS#8: inner ECPrivateKey missing sequence");
  const innerSeq = readASN1Length(pkcs8Priv, j); j = innerSeq.next;
  if (pkcs8Priv[j++] !== 0x02) throw new Error("Invalid PKCS#8: inner missing version");
  const innerVer = readASN1Length(pkcs8Priv, j); j = innerVer.next + innerVer.length;
  if (pkcs8Priv[j++] !== 0x04) throw new Error("Invalid PKCS#8: inner missing private key octet string");
  const privLenInfo = readASN1Length(pkcs8Priv, j); j = privLenInfo.next;
  const priv = pkcs8Priv.slice(j, j + privLenInfo.length);
  if (priv.length !== 32) throw new Error("Invalid private key length");

  const pub = secp256k1.getPublicKey(priv, false);
  const d = base64urlEncode(priv);
  const x = base64urlEncode(pub.slice(1, 33));
  const y = base64urlEncode(pub.slice(33, 65));
  return { kty: "EC", crv: "secp256k1", x, y, d } as JsonWebKey;
}

function writeASN1Length(len: number): Uint8Array {
  if (len < 0x80) return Uint8Array.of(len);
  const bytes: number[] = [];
  let val = len;
  while (val > 0) {
    bytes.push(val & 0xff);
    val >>= 8;
  }
  bytes.reverse();
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

export function exportSecp256k1PrivateKeyToPem(priv: Uint8Array): string {
  const pub = secp256k1.getPublicKey(priv, false); // uncompressed 0x04 + X + Y
  // ECPrivateKey ASN.1 (SEC1):
  // SEQUENCE {
  //   INTEGER 1,
  //   OCTET STRING (32 priv),
  //   [0] parameters OBJECT IDENTIFIER (secp256k1 = 1.3.132.0.10),
  //   [1] publicKey BIT STRING (uncompressed pubkey)
  // }
  const version = Uint8Array.of(0x02, 0x01, 0x01);
  const octet = Uint8Array.of(0x04, ...writeASN1Length(priv.length), ...priv);
  const oid = Uint8Array.of(0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a); // 1.3.132.0.10
  const params = Uint8Array.of(0xa0, ...writeASN1Length(oid.length), ...oid);
  const bitString = Uint8Array.of(0x03, ...writeASN1Length(pub.length + 1), 0x00, ...pub);
  const pubKey = Uint8Array.of(0xa1, ...writeASN1Length(bitString.length), ...bitString);
  const body = new Uint8Array(version.length + octet.length + params.length + pubKey.length);
  body.set(version, 0);
  body.set(octet, version.length);
  body.set(params, version.length + octet.length);
  body.set(pubKey, version.length + octet.length + params.length);
  const seq = Uint8Array.of(0x30, ...writeASN1Length(body.length), ...body);
  // base64 encode
  const G: any = globalThis as any;
  let b64: string;
  if (typeof G.Buffer !== "undefined") {
    b64 = G.Buffer.from(seq).toString("base64");
  } else {
    const binary = new TextDecoder('latin1').decode(seq);
    b64 = btoa(binary);
  }
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return [
    "-----BEGIN EC PRIVATE KEY-----",
    ...lines,
    "-----END EC PRIVATE KEY-----",
    "",
  ].join("\n");
}

