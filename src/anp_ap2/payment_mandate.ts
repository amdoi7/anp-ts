import { z } from "zod";
import {
  PaymentMandateContentsSchema,
  type PaymentMandateContents,
  type PaymentMandate,
  PaymentMandateSchema,
} from "./models.js";
import { jcs } from "./utils.js";
import { BaseMandateBuilder } from "./builder_base.js";
import { LogManager, NullLogger } from "@/core/logging.js";

/**
 * Options for configuring the PaymentMandateBuilder.
 */
export interface PaymentMandateBuilderOptions {
  user_private_key_pem: string; // PKCS#8
  user_did: string;
  user_kid?: string;
  merchant_did?: string;
  algorithm?: "RS256" | "ES256K";
  ttl_seconds?: number;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

const PaymentMandateBuilderOptionsSchema = z.object({
  user_private_key_pem: z.string().min(1),
  user_did: z.string().min(1),
  user_kid: z.string().min(1).optional(),
  merchant_did: z.string().min(1).optional(),
  algorithm: z.enum(["RS256", "ES256K"]).optional(),
  ttl_seconds: z.number().int().positive().optional(),
  logger: z.instanceof(LogManager).optional(),
});

type PaymentMandateBuilderOpts = Required<Omit<PaymentMandateBuilderOptions, "user_kid" | "merchant_did">> & {
  user_kid?: string;
  merchant_did?: string;
};

/**
 * Builds a Payment Mandate, which is a JWT signed by the user
 * to authorize a payment.
 */
export class PaymentMandateBuilder extends BaseMandateBuilder<PaymentMandateBuilderOpts, PaymentMandate> {
  private readonly logger: LogManager;

  /**
   * @param opts - Configuration options for the builder.
   * @param opts.user_private_key_pem - The user's private key in PKCS#8 PEM format.
   * @param opts.user_did - The user's Decentralized Identifier (DID).
   */
  constructor(opts: PaymentMandateBuilderOptions) {
    const parsed = PaymentMandateBuilderOptionsSchema.parse(opts);
    super({
      algorithm: parsed.algorithm ?? "RS256",
      ttl_seconds: parsed.ttl_seconds ?? 180 * 24 * 60 * 60,
      user_private_key_pem: parsed.user_private_key_pem,
      user_did: parsed.user_did,
      user_kid: parsed.user_kid,
      merchant_did: parsed.merchant_did,
    });

    this.logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "PaymentMandateBuilder" });
    this.logger.info("PaymentMandateBuilder initialized");
  }

  /**
   * Builds and signs the payment mandate JWT.
   * @param contentsInput - The contents of the payment mandate.
   * @param cart_hash - The hash of the original cart mandate contents.
   * @param extensions - Optional extensions to include in the mandate.
   * @returns A promise that resolves to the PaymentMandate.
   */
  async build(contentsInput: PaymentMandateContents, cart_hash: string, extensions?: string[]): Promise<PaymentMandate> {
    this.logger.debug("Building payment mandate", { paymentMandateId: contentsInput.payment_mandate_id, cart_hash });
    try {
      const contents = PaymentMandateContentsSchema.parse(contentsInput);
      const ch = z.string().min(1).parse(cart_hash);
      const ext = extensions ? z.array(z.string()).parse(extensions) : undefined;

      const jwt = await this.sign(
        {
          typ: "JWT",
          cart_hash: ch,
          contents: JSON.parse(jcs(contents)),
        },
        this.opts.user_private_key_pem,
        this.opts.algorithm,
        this.opts.user_did,
        this.opts.ttl_seconds,
        this.opts.user_kid,
        this.opts.merchant_did,
      );

      const mandate = PaymentMandateSchema.parse({ payment_mandate_contents: contents, user_authorization: jwt, extensions: ext });
      this.logger.info("Payment mandate built successfully", { paymentMandateId: contentsInput.payment_mandate_id });
      return mandate;
    } catch (error: any) {
      this.logger.error("Failed to build payment mandate", error, { paymentMandateId: contentsInput.payment_mandate_id, cart_hash });
      throw error; // Re-throw the error after logging
    }
  }
}


