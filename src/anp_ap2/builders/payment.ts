import { z } from "zod";

import {
  PaymentMandateContentsSchema,
  type PaymentMandateContents,
  PaymentMandateSchema,
  type PaymentMandate,
} from "../models/index.js";
import { jcs } from "../utils/canonical.js";
import { BaseMandateBuilder, type SignerConfig } from "./base.js";
import { AP2_DEFAULTS, type SupportedJwsAlg } from "../constants.js";
import { MandateBuildError, SchemaValidationError } from "../errors.js";
import { LogManager, NullLogger } from "@/core/logging.js";

export interface PaymentMandateBuilderOptions {
  userPrivateKeyPem: string;
  userDid: string;
  userKid?: string;
  merchantDid?: string;
  algorithm?: SupportedJwsAlg;
  ttlSeconds?: number;
  logger?: LogManager;
}

const PaymentMandateBuilderOptionsSchema = z.object({
  userPrivateKeyPem: z.string().min(1),
  userDid: z.string().min(1),
  userKid: z.string().min(1).optional(),
  merchantDid: z.string().min(1).optional(),
  algorithm: z.union([z.literal("RS256"), z.literal("ES256K")]).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  logger: z.instanceof(LogManager).optional(),
});

interface NormalizedPaymentOptions {
  userPrivateKeyPem: string;
  userDid: string;
  algorithm: SupportedJwsAlg;
  ttlSeconds: number;
  logger: LogManager;
  userKid?: string;
  merchantDid?: string;
}

/**
 * Builder for creating signed payment mandates.
 *
 * A payment mandate is a user-signed authorization for payment, linked to a cart mandate
 * via cart hash. It proves the user's consent to the payment terms.
 *
 * @example
 * ```typescript
 * import { ap2 } from "anp-ts";
 *
 * const builder = ap2.builders.createPaymentMandateBuilder({
 *   userPrivateKeyPem: userKey,
 *   userDid: "did:wba:example:user",
 *   merchantDid: "did:wba:example:merchant",
 *   algorithm: "RS256", // or ES256, ES384, ES512
 * });
 *
 * const cartHash = ap2.utils.cartHash(cartMandate.contents);
 * const paymentContents = {
 *   payment_mandate_id: "pm-001",
 *   payment_details_id: "pd-001",
 *   settlement_total: { label: "Total", amount: { currency: "USD", value: "99.99" } },
 *   payment_response: { request_id: "cart-001", method_name: "crypto" },
 *   timestamp: new Date().toISOString(),
 * };
 *
 * const mandate = await builder.build(paymentContents, cartHash);
 * ```
 */
export class PaymentMandateBuilder extends BaseMandateBuilder<NormalizedPaymentOptions, PaymentMandate> {
  constructor(opts: PaymentMandateBuilderOptions) {
    const parsed = PaymentMandateBuilderOptionsSchema.parse(opts);
    const logger = (parsed.logger ?? new LogManager(new NullLogger())).withContext({ module: "PaymentMandateBuilder" });

    const normalized: NormalizedPaymentOptions = {
      userPrivateKeyPem: parsed.userPrivateKeyPem,
      userDid: parsed.userDid,
      algorithm: parsed.algorithm ?? AP2_DEFAULTS.DEFAULT_ALGORITHM,
      ttlSeconds: parsed.ttlSeconds ?? AP2_DEFAULTS.PAYMENT_TTL_SECONDS,
      logger,
    };

    if (parsed.userKid) normalized.userKid = parsed.userKid;
    if (parsed.merchantDid) normalized.merchantDid = parsed.merchantDid;

    super(normalized);
  }

  private get logger(): LogManager {
    return this.opts.logger;
  }

  /**
   * Builds a signed payment mandate.
   * @param contentsInput The payment mandate contents to sign
   * @param cart_hash The cart hash from the corresponding cart mandate
   * @param extensions Optional extension data
   * @returns Signed payment mandate
   * @throws {SchemaValidationError} If payment mandate contents validation fails
   * @throws {MandateBuildError} If mandate building fails
   */
  async build(contentsInput: PaymentMandateContents, cart_hash: string, extensions?: string[]): Promise<PaymentMandate> {
    this.logger.debug("Building payment mandate", { paymentMandateId: contentsInput.payment_mandate_id, cart_hash });

    try {
      const contents = PaymentMandateContentsSchema.parse(contentsInput);
      const cartHash = z.string().min(1).parse(cart_hash);
      const ext = extensions ? z.array(z.string()).parse(extensions) : undefined;

      const signerConfig: SignerConfig = {
        privateKeyPem: this.opts.userPrivateKeyPem,
        algorithm: this.opts.algorithm,
        issuer: this.opts.userDid,
        ttlSeconds: this.opts.ttlSeconds,
      };

      if (this.opts.merchantDid) signerConfig.audience = this.opts.merchantDid;
      if (this.opts.userKid) signerConfig.keyId = this.opts.userKid;

      const jws = await this.sign(
        {
          typ: "JWT",
          cart_hash: cartHash,
          contents: JSON.parse(jcs(contents)),
        },
        signerConfig,
      );

      const mandate = PaymentMandateSchema.parse({ payment_mandate_contents: contents, user_authorization: jws, extensions: ext });
      this.logger.info("Payment mandate built successfully", { paymentMandateId: contentsInput.payment_mandate_id });
      return mandate;
    } catch (error) {
      this.logger.error("Failed to build payment mandate", error as Error, { paymentMandateId: contentsInput.payment_mandate_id, cart_hash });
      if (error instanceof z.ZodError) {
        throw new SchemaValidationError("PaymentMandateContents", error.message);
      }
      if (error instanceof MandateBuildError || error instanceof SchemaValidationError) {
        throw error;
      }
      throw new MandateBuildError("payment", (error as Error).message);
    }
  }
}

export function createPaymentMandateBuilder(options: PaymentMandateBuilderOptions): PaymentMandateBuilder {
  return new PaymentMandateBuilder(options);
}


