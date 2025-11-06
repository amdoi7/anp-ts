import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";

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

