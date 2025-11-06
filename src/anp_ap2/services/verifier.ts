import type { JWTPayload } from "jose";
import { z } from "zod";

import { LogManager, NullLogger } from "@/core/logging.js";
import { verifyJwtWithAlgorithm } from "@/core/jwt.js";

import { CartHashMismatchError, MandateVerificationError, JwtVerificationError, InvalidKeyError } from "../errors.js";
import type { SupportedJwsAlg } from "../constants.js";
import { cartHash } from "../utils/canonical.js";
import { CartMandateSchema, PaymentMandateSchema, type CartMandate, type PaymentMandate } from "../models/index.js";

export interface CartMandateVerifyOptions {
  merchant_public_key_pem: string;
  algorithm?: SupportedJwsAlg;
  expected_aud?: string;
  logger?: LogManager;
}

export interface PaymentMandateVerifyOptions {
  user_public_key_pem: string;
  algorithm?: SupportedJwsAlg;
  expected_aud?: string;
  expected_cart_hash?: string;
  logger?: LogManager;
}

const CartMandateVerifyOptionsSchema = z.object({
  merchant_public_key_pem: z.string().min(1),
  algorithm: z.union([z.literal("RS256"), z.literal("ES256K")]).optional(),
  expected_aud: z.string().min(1).optional(),
  logger: z.instanceof(LogManager).optional(),
});

const PaymentMandateVerifyOptionsSchema = z.object({
  user_public_key_pem: z.string().min(1),
  algorithm: z.union([z.literal("RS256"), z.literal("ES256K")]).optional(),
  expected_aud: z.string().min(1).optional(),
  expected_cart_hash: z.string().min(1).optional(),
  logger: z.instanceof(LogManager).optional(),
});

async function verifyJwt(
  token: string,
  publicKeyPem: string,
  algorithm: SupportedJwsAlg,
  expectedAudience?: string,
): Promise<JWTPayload> {
  try {
    // Use core JWT verification function (supports ES256K + standard algorithms)
    const options = expectedAudience ? { audience: expectedAudience } : undefined;
    const payload = await verifyJwtWithAlgorithm(token, publicKeyPem, algorithm, options);
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.includes("key")) {
      throw new InvalidKeyError("public", error.message);
    }
    throw new JwtVerificationError((error as Error).message);
  }
}

/**
 * Verifies a cart mandate's signature and integrity.
 *
 * This function validates:
 * - JWT signature using merchant's public key
 * - Cart hash matches the contents
 * - JWT hasn't expired
 * - Audience matches (if specified)
 *
 * @param mandate - The cart mandate to verify
 * @param opts - Verification options including merchant's public key
 * @returns The verified JWT payload
 * @throws {JwtVerificationError} If JWT verification fails
 * @throws {CartHashMismatchError} If cart hash doesn't match
 * @throws {InvalidKeyError} If public key is invalid
 *
 * @example
 * ```typescript
 * import { ap2 } from "anp-ts";
 *
 * try {
 *   const payload = await ap2.verifiers.verifyCartMandate(cartMandate, {
 *     merchant_public_key_pem: merchantPublicKey,
 *     algorithm: "RS256", // "RS256" or "ES256K", must match signing algorithm
 *     expected_aud: "did:wba:example:user", // Optional
 *   });
 *   console.log("Verified! Issued by:", payload.iss);
 * } catch (error) {
 *   if (error instanceof ap2.errors.CartHashMismatchError) {
 *     console.error("Cart contents have been tampered with!");
 *   }
 * }
 * ```
 */
export async function verifyCartMandate(mandate: CartMandate, opts: CartMandateVerifyOptions): Promise<JWTPayload> {
  const logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "CartMandateVerifier" });
  const parsedMandate = CartMandateSchema.parse(mandate);
  const parsedOpts = CartMandateVerifyOptionsSchema.parse(opts);
  const algorithm = parsedOpts.algorithm ?? "RS256";

  logger.debug("Verifying cart mandate", { cartId: parsedMandate.contents.id });

  try {
    const payload = await verifyJwt(parsedMandate.merchant_authorization, parsedOpts.merchant_public_key_pem, algorithm, parsedOpts.expected_aud);

    const expectedHash = cartHash(parsedMandate.contents);
    if (payload.cart_hash !== expectedHash) {
      logger.warn("Cart hash mismatch", { cartId: parsedMandate.contents.id, expectedHash, actualHash: payload.cart_hash });
      throw new CartHashMismatchError();
    }

    logger.info("Cart mandate verification successful", { cartId: parsedMandate.contents.id });
    return payload;
  } catch (error) {
    if (error instanceof CartHashMismatchError) {
      logger.error("Cart hash mismatch during verification", error, { cartId: parsedMandate.contents.id });
      throw error;
    }
    logger.error("Failed to verify cart mandate", error as Error, { cartId: parsedMandate.contents.id });
    throw new MandateVerificationError((error as Error).message);
  }
}

export async function verifyPaymentMandate(mandate: PaymentMandate, opts: PaymentMandateVerifyOptions): Promise<JWTPayload> {
  const logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "PaymentMandateVerifier" });
  const parsedMandate = PaymentMandateSchema.parse(mandate);
  const parsedOpts = PaymentMandateVerifyOptionsSchema.parse(opts);
  const algorithm = parsedOpts.algorithm ?? "RS256";

  logger.debug("Verifying payment mandate", { paymentMandateId: parsedMandate.payment_mandate_contents.payment_mandate_id });

  try {
    const payload = await verifyJwt(parsedMandate.user_authorization, parsedOpts.user_public_key_pem, algorithm, parsedOpts.expected_aud);

    if (parsedOpts.expected_cart_hash && payload.cart_hash !== parsedOpts.expected_cart_hash) {
      logger.warn("Payment mandate cart hash mismatch", {
        paymentMandateId: parsedMandate.payment_mandate_contents.payment_mandate_id,
        expectedHash: parsedOpts.expected_cart_hash,
        actualHash: payload.cart_hash,
      });
      throw new CartHashMismatchError();
    }

    logger.info("Payment mandate verification successful", { paymentMandateId: parsedMandate.payment_mandate_contents.payment_mandate_id });
    return payload;
  } catch (error) {
    if (error instanceof CartHashMismatchError) {
      logger.error("Cart hash mismatch during payment mandate verification", error, {
        paymentMandateId: parsedMandate.payment_mandate_contents.payment_mandate_id,
      });
      throw error;
    }
    logger.error("Failed to verify payment mandate", error as Error, {
      paymentMandateId: parsedMandate.payment_mandate_contents.payment_mandate_id,
    });
    throw new MandateVerificationError((error as Error).message);
  }
}

export const mandateVerifier = {
  verifyCartMandate,
  verifyPaymentMandate,
};


