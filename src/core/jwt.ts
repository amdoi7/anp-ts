import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTHeaderParameters } from "jose";
import type { JWTPayload, JWTVerifyOptions } from "jose";
import { signSecp256k1, verifySecp256k1Signature, importSecp256k1PrivateKeyFromPem } from "@/core/crypto.js";
import { base64urlEncode, base64urlDecode } from "@/core/utils.js";

export interface IssueOptions {
  issuer?: string;
  subject?: string;
  audience?: string | string[];
  expiresIn?: string; // e.g., "15m"
}

export async function issueJwt(
  payload: JWTPayload,
  secret: Uint8Array,
  options: IssueOptions = {}
): Promise<string> {
  let jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" });
  if (options.issuer) jwt = jwt.setIssuer(options.issuer);
  if (options.subject) jwt = jwt.setSubject(options.subject);
  if (options.audience) jwt = jwt.setAudience(options.audience);
  if (options.expiresIn) jwt = jwt.setExpirationTime(options.expiresIn);
  return await jwt.sign(secret);
}

export async function verifyJwt<T extends JWTPayload = JWTPayload>(
  token: string,
  secret: Uint8Array
): Promise<{ payload: T } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { payload: payload as T };
  } catch {
    return null;
  }
}

/**
 * Sign JWT with algorithm support for RS256 and ES256K.
 * Matches Python PyJWT implementation.
 *
 * @param payload - JWT payload claims
 * @param privateKeyPem - Private key in PEM format (PKCS#8)
 * @param algorithm - Signing algorithm: "RS256" or "ES256K"
 * @param extraHeaders - Additional JWT header parameters (e.g., kid)
 * @returns Signed JWT string
 */
export async function signJwtWithAlgorithm(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  algorithm: "RS256" | "ES256K",
  extraHeaders?: Omit<JWTHeaderParameters, "alg" | "typ">
): Promise<string> {
  if (algorithm === "ES256K") {
    // Use secp256k1 from @noble/curves (matches Python PyJWT ES256K support)
    const privateJwk = importSecp256k1PrivateKeyFromPem(privateKeyPem);

    // Build JWT manually for ES256K
    const headerObj = { alg: "ES256K", typ: "JWT", ...extraHeaders };
    const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(headerObj)));
    const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = await signSecp256k1(privateJwk, new TextEncoder().encode(signingInput));
    const signatureB64 = base64urlEncode(signature);

    return `${signingInput}.${signatureB64}`;
  } else {
    // Use jose library for RS256
    const key = await importPKCS8(privateKeyPem, algorithm);
    const jwt = new SignJWT(payload as JWTPayload).setProtectedHeader({ alg: algorithm, typ: "JWT", ...extraHeaders });
    return await jwt.sign(key);
  }
}

/**
 * Verify JWT with algorithm support for RS256 and ES256K.
 * Matches Python PyJWT implementation.
 *
 * @param token - JWT token string
 * @param publicKeyPem - Public key in PEM format
 * @param algorithm - Expected algorithm: "RS256" or "ES256K"
 * @param options - Verification options (audience, etc.)
 * @returns Verified JWT payload
 */
export async function verifyJwtWithAlgorithm(
  token: string,
  publicKeyPem: string,
  algorithm: "RS256" | "ES256K",
  options?: JWTVerifyOptions
): Promise<JWTPayload> {
  if (algorithm === "ES256K") {
    // Use secp256k1 from @noble/curves (matches Python PyJWT ES256K support)
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const headerB64 = parts[0]!;
    const payloadB64 = parts[1]!;
    const signatureB64 = parts[2]!;
    const signingInput = `${headerB64}.${payloadB64}`;

    // Parse and verify header
    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
    if (!header.alg || header.alg !== "ES256K") {
      throw new Error(`Algorithm mismatch: expected ES256K, got ${header.alg ?? "none"}`);
    }

    // Verify signature
    const publicJwk = importSecp256k1PrivateKeyFromPem(publicKeyPem); // Will parse public key from PEM
    const isValid = await verifySecp256k1Signature(
      publicJwk,
      new TextEncoder().encode(signingInput),
      signatureB64
    );

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Parse and validate payload
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as JWTPayload;

    // Verify time claims (matches PyJWT behavior)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error("JWT expired");
    }
    if (payload.nbf && payload.nbf > now) {
      throw new Error("JWT not yet valid");
    }

    // Verify audience if specified
    if (options?.audience) {
      const expectedAud = Array.isArray(options.audience) ? options.audience : [options.audience];
      const actualAud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
      if (!expectedAud.some(aud => actualAud.includes(aud))) {
        throw new Error("Audience mismatch");
      }
    }

    return payload;
  } else {
    // Use jose library for RS256
    const key = await importSPKI(publicKeyPem, algorithm);
    const { payload } = await jwtVerify(token, key, { algorithms: [algorithm], ...options });
    return payload;
  }
}
