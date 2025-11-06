import type { JWTHeaderParameters } from "jose";

import { signJwtWithAlgorithm } from "@/core/jwt.js";
import { JwtSigningError, InvalidKeyError } from "../errors.js";
import type { SupportedJwsAlg } from "../constants.js";

export interface SignerConfig {
  privateKeyPem: string;
  algorithm: SupportedJwsAlg;
  issuer: string;
  ttlSeconds: number;
  audience?: string;
  keyId?: string;
}

/**
 * Base class encapsulating JWS signing for AP2 builders.
 */
export abstract class BaseMandateBuilder<TOptions, TMandate> {
  constructor(protected readonly opts: TOptions) {}

  /**
   * Signs a JWT with the provided payload and configuration.
   * Uses core JWT functions with support for ES256K (secp256k1) and standard algorithms.
   * @throws {InvalidKeyError} If the private key is invalid
   * @throws {JwtSigningError} If JWT signing fails
   */
  protected async sign(payloadClaims: Record<string, unknown>, config: SignerConfig): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);

      // Build complete payload with standard JWT claims
      const payload: Record<string, unknown> = {
        ...payloadClaims,
        iss: config.issuer,
        iat: now,
        exp: now + config.ttlSeconds,
      };

      if (config.audience) {
        payload.aud = config.audience;
      }

      // Build extra headers (kid is optional)
      const extraHeaders = config.keyId ? { kid: config.keyId } : undefined;

      // Use core JWT signing function (supports ES256K + standard algorithms)
      const jwt = await signJwtWithAlgorithm(
        payload,
        config.privateKeyPem,
        config.algorithm,
        extraHeaders
      );

      return jwt;
    } catch (error) {
      if (error instanceof Error && error.message.includes("key")) {
        throw new InvalidKeyError("private", error.message);
      }
      throw new JwtSigningError((error as Error).message);
    }
  }

  abstract build(...args: unknown[]): Promise<TMandate>;
}


