import { SignJWT, importPKCS8 } from "jose";

/**
 * An abstract base class for building and signing mandates.
 * @internal
 */
export abstract class BaseMandateBuilder<TOptions, TMandate> {
  constructor(protected readonly opts: TOptions) {}

  /**
   * Signs a JWT with the provided claims and configuration.
   * @param payloadClaims - The claims to include in the JWT payload.
   * @param privateKeyPem - The private key in PKCS#8 PEM format.
   * @param alg - The signing algorithm.
   * @param issuer - The 'iss' (issuer) claim.
   * @param ttl - The 'exp' (expiration time) in seconds from now.
   * @param kid - The 'kid' (Key ID) header parameter.
   * @param audience - The 'aud' (audience) claim.
   * @returns A promise that resolves to the signed JWT string.
   */
  protected async sign(
    payloadClaims: Record<string, any>,
    privateKeyPem: string,
    alg: "RS256" | "ES256K",
    issuer: string,
    ttl: number,
    kid?: string,
    audience?: string,
  ): Promise<string> {
    const key = await importPKCS8(privateKeyPem, alg);
    const now = Math.floor(Date.now() / 1000);

    const jwt = new SignJWT(payloadClaims)
      .setProtectedHeader({ alg, kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .sign(key);
    return jwt;
  }

  /**
   * Abstract build method to be implemented by subclasses.
   */
  abstract build(...args: any[]): Promise<TMandate>;
}
