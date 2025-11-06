import { jwtVerify, importSPKI, type JWTPayload } from "jose";
import { z } from "zod";
import { CartMandateSchema, PaymentMandateSchema, type CartMandate, type PaymentMandate } from "./models.js";
import { cartHash } from "./utils.js";
import { CartHashMismatchError, MandateVerificationError } from "./errors.js";
import { LogManager, NullLogger } from "@/core/logging.js";

/**
 * Options for verifying a CartMandate.
 */
export interface CartMandateVerifyOptions {
  merchant_public_key_pem: string; // SPKI
  algorithm?: "RS256" | "ES256K";
  expected_aud?: string;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

const CartMandateVerifyOptionsSchema = z.object({
  merchant_public_key_pem: z.string().min(1),
  algorithm: z.enum(["RS256", "ES256K"]).optional(),
  expected_aud: z.string().min(1).optional(),
  logger: z.instanceof(LogManager).optional(),
});

/**
 * Verifies a CartMandate JWT.
 * It checks the signature, audience, and cart hash.
 * @param mandate - The cart mandate object to verify.
 * @param opts - The verification options.
 * @returns A promise that resolves with the JWT payload if verification is successful.
 * @throws {MandateVerificationError} if the JWT is invalid or the signature fails.
 * @throws {CartHashMismatchError} if the cart_hash in the JWT does not match the hash of the contents.
 */
export async function verifyCartMandate(mandate: CartMandate, opts: CartMandateVerifyOptions): Promise<JWTPayload> {
  const logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "CartMandateVerifier" });
  logger.debug("Verifying cart mandate", { cartId: mandate.contents.id });
  const parsedMandate = CartMandateSchema.parse(mandate);
  const vopts = CartMandateVerifyOptionsSchema.parse(opts);
  const alg = vopts.algorithm ?? "RS256";

  try {
    const key = await importSPKI(vopts.merchant_public_key_pem, alg);
    const { payload } = await jwtVerify(parsedMandate.merchant_authorization, key, {
      audience: vopts.expected_aud,
      algorithms: [alg],
    });
    logger.debug("JWT verified successfully", { cartId: mandate.contents.id, payload });

    const expectedHash = cartHash(parsedMandate.contents);
    if (payload.cart_hash !== expectedHash) {
      logger.warn("Cart hash mismatch", { cartId: mandate.contents.id, expectedHash, actualHash: payload.cart_hash });
      throw new CartHashMismatchError();
    }
    logger.info("Cart mandate verification successful", { cartId: mandate.contents.id });
    return payload;
  } catch (e: any) {
    if (e instanceof CartHashMismatchError) {
        logger.error("Cart hash mismatch during verification", e, { cartId: mandate.contents.id });
        throw e;
    }
    logger.error("Failed to verify cart mandate", e, { cartId: mandate.contents.id });
    throw new MandateVerificationError(e.message);
  }
}

/**
 * Options for verifying a PaymentMandate.
 */
export interface PaymentMandateVerifyOptions {
  user_public_key_pem: string; // SPKI
  algorithm?: "RS256" | "ES256K";
  expected_aud?: string;
  expected_cart_hash?: string;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

const PaymentMandateVerifyOptionsSchema = z.object({
  user_public_key_pem: z.string().min(1),
  algorithm: z.enum(["RS256", "ES256K"]).optional(),
  expected_aud: z.string().min(1).optional(),
  expected_cart_hash: z.string().min(1).optional(),
  logger: z.instanceof(LogManager).optional(),
});

/**
 * Verifies a PaymentMandate JWT.
 * It checks the signature, audience, and optionally the cart hash.
 * @param mandate - The payment mandate object to verify.
 * @param opts - The verification options.
 * @returns A promise that resolves with the JWT payload if verification is successful.
 * @throws {MandateVerificationError} if the JWT is invalid or the signature fails.
 * @throws {CartHashMismatchError} if the cart_hash does not match the expected hash.
 */
export async function verifyPaymentMandate(mandate: PaymentMandate, opts: PaymentMandateVerifyOptions): Promise<JWTPayload> {
  const logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "PaymentMandateVerifier" });
  logger.debug("Verifying payment mandate", { paymentMandateId: mandate.payment_mandate_contents.payment_mandate_id });
  const parsedMandate = PaymentMandateSchema.parse(mandate);
  const vopts = PaymentMandateVerifyOptionsSchema.parse(opts);
  const alg = vopts.algorithm ?? "RS256";

  try {
    const key = await importSPKI(vopts.user_public_key_pem, alg);
    const { payload } = await jwtVerify(parsedMandate.user_authorization, key, {
      audience: vopts.expected_aud,
      algorithms: [alg],
    });
    logger.debug("JWT verified successfully", { paymentMandateId: mandate.payment_mandate_contents.payment_mandate_id, payload });

    if (vopts.expected_cart_hash && payload.cart_hash !== vopts.expected_cart_hash) {
      logger.warn("Payment mandate cart hash mismatch", { paymentMandateId: mandate.payment_mandate_contents.payment_mandate_id, expectedHash: vopts.expected_cart_hash, actualHash: payload.cart_hash });
      throw new CartHashMismatchError();
    }
    logger.info("Payment mandate verification successful", { paymentMandateId: mandate.payment_mandate_contents.payment_mandate_id });
    return payload;
  } catch (e: any) {
    if (e instanceof CartHashMismatchError) {
        logger.error("Cart hash mismatch during payment mandate verification", e, { paymentMandateId: mandate.payment_mandate_contents.payment_mandate_id });
        throw e;
    }
    logger.error("Failed to verify payment mandate", e, { paymentMandateId: mandate.payment_mandate_contents.payment_mandate_id });
    throw new MandateVerificationError(e.message);
  }
}


