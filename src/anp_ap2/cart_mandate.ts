import { z } from "zod";
import { CartContentsSchema, type CartContents, type CartMandate, CartMandateSchema } from "./models.js";
import { cartHash, jcs } from "./utils.js";
import { BaseMandateBuilder } from "./builder_base.js";
import { LogManager, NullLogger } from "@/core/logging.js";

/**
 * Options for configuring the CartMandateBuilder.
 */
export interface CartMandateBuilderOptions {
  merchant_private_key_pem: string; // PKCS#8
  merchant_did: string;
  merchant_kid?: string;
  algorithm?: "RS256" | "ES256K";
  shopper_did?: string;
  ttl_seconds?: number;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

const CartMandateBuilderOptionsSchema = z.object({
  merchant_private_key_pem: z.string().min(1),
  merchant_did: z.string().min(1),
  merchant_kid: z.string().min(1).optional(),
  algorithm: z.enum(["RS256", "ES256K"]).optional(),
  shopper_did: z.string().min(1).optional(),
  ttl_seconds: z.number().int().positive().optional(),
  logger: z.instanceof(LogManager).optional(),
});

type CartMandateBuilderOpts = Required<Omit<CartMandateBuilderOptions, "merchant_kid" | "shopper_did"> > & {
  merchant_kid?: string;
  shopper_did?: string;
};

/**
 * Builds a Cart Mandate, which is a JWT signed by the merchant
 * to authorize a shopping cart's contents.
 */
export class CartMandateBuilder extends BaseMandateBuilder<CartMandateBuilderOpts, CartMandate> {
  private readonly logger: LogManager;

  /**
   * @param opts - Configuration options for the builder.
   * @param opts.merchant_private_key_pem - The merchant's private key in PKCS#8 PEM format.
   * @param opts.merchant_did - The merchant's Decentralized Identifier (DID).
   */
  constructor(opts: CartMandateBuilderOptions) {
    const parsed = CartMandateBuilderOptionsSchema.parse(opts);
    super({
      algorithm: parsed.algorithm ?? "RS256",
      ttl_seconds: parsed.ttl_seconds ?? 15 * 60,
      merchant_private_key_pem: parsed.merchant_private_key_pem,
      merchant_did: parsed.merchant_did,
      merchant_kid: parsed.merchant_kid,
      shopper_did: parsed.shopper_did,
    });

    this.logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "CartMandateBuilder" });
    this.logger.info("CartMandateBuilder initialized");
  }

  /**
   * Builds and signs the cart mandate JWT.
   * @param input - The contents of the cart.
   * @param extensions - Optional extensions to include in the mandate.
   * @returns A promise that resolves to the CartMandate.
   */
  async build(input: CartContents, extensions?: string[]): Promise<CartMandate> {
    this.logger.debug("Building cart mandate", { cartId: input.id });
    try {
      const contents = CartContentsSchema.parse(input);
      const ext = extensions ? z.array(z.string()).parse(extensions) : undefined;
      const hash = cartHash(contents);

      const jwt = await this.sign(
        {
          typ: "JWT",
          cart_hash: hash,
          contents: JSON.parse(jcs(contents)),
        },
        this.opts.merchant_private_key_pem,
        this.opts.algorithm,
        this.opts.merchant_did,
        this.opts.ttl_seconds,
        this.opts.merchant_kid,
        this.opts.shopper_did,
      );

      const mandate = CartMandateSchema.parse({ contents, merchant_authorization: jwt, extensions: ext });
      this.logger.info("Cart mandate built successfully", { cartId: input.id });
      return mandate;
    } catch (error: any) {
      this.logger.error("Failed to build cart mandate", error, { cartId: input.id });
      throw error; // Re-throw the error after logging
    }
  }
}


