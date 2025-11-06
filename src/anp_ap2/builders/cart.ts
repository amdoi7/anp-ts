import { z } from "zod";

import {
  CartContentsSchema,
  type CartContents,
  CartMandateSchema,
  type CartMandate,
} from "../models/index.js";
import { cartHash, jcs } from "../utils/canonical.js";
import { BaseMandateBuilder, type SignerConfig } from "./base.js";
import { AP2_DEFAULTS, type SupportedJwsAlg } from "../constants.js";
import { MandateBuildError, SchemaValidationError } from "../errors.js";
import { LogManager, NullLogger } from "@/core/logging.js";

export interface CartMandateBuilderOptions {
  merchantPrivateKeyPem: string;
  merchantDid: string;
  merchantKid?: string;
  shopperDid?: string;
  algorithm?: SupportedJwsAlg;
  ttlSeconds?: number;
  logger?: LogManager;
}

const CartMandateBuilderOptionsSchema = z.object({
  merchantPrivateKeyPem: z.string().min(1),
  merchantDid: z.string().min(1),
  merchantKid: z.string().min(1).optional(),
  shopperDid: z.string().min(1).optional(),
  algorithm: z.union([z.literal("RS256"), z.literal("ES256K")]).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  logger: z.instanceof(LogManager).optional(),
});

interface NormalizedCartOptions {
  merchantPrivateKeyPem: string;
  merchantDid: string;
  algorithm: SupportedJwsAlg;
  ttlSeconds: number;
  logger: LogManager;
  merchantKid?: string;
  shopperDid?: string;
}

/**
 * Builder for creating signed cart mandates.
 *
 * A cart mandate is a merchant-signed authorization for shopping cart contents,
 * ensuring the cart data hasn't been tampered with.
 *
 * @example
 * ```typescript
 * import { ap2 } from "anp-ts";
 *
 * const builder = ap2.builders.createCartMandateBuilder({
 *   merchantPrivateKeyPem: merchantKey,
 *   merchantDid: "did:wba:example:merchant",
 *   algorithm: "RS256", // or ES256, ES384, ES512
 *   ttlSeconds: 900, // 15 minutes
 * });
 *
 * const cartContents = {
 *   id: "cart-001",
 *   user_signature_required: false,
 *   payment_request: {
 *     method_data: [{ supported_methods: "crypto" }],
 *     details: { id: "pd-001", total: { label: "Total", amount: { currency: "USD", value: "99.99" } } }
 *   }
 * };
 *
 * const mandate = await builder.build(cartContents);
 * ```
 */
export class CartMandateBuilder extends BaseMandateBuilder<NormalizedCartOptions, CartMandate> {
  constructor(opts: CartMandateBuilderOptions) {
    const parsed = CartMandateBuilderOptionsSchema.parse(opts);
    const logger = (parsed.logger ?? new LogManager(new NullLogger())).withContext({ module: "CartMandateBuilder" });

    const normalized: NormalizedCartOptions = {
      merchantPrivateKeyPem: parsed.merchantPrivateKeyPem,
      merchantDid: parsed.merchantDid,
      algorithm: parsed.algorithm ?? AP2_DEFAULTS.DEFAULT_ALGORITHM,
      ttlSeconds: parsed.ttlSeconds ?? AP2_DEFAULTS.CART_TTL_SECONDS,
      logger,
    };

    if (parsed.merchantKid) normalized.merchantKid = parsed.merchantKid;
    if (parsed.shopperDid) normalized.shopperDid = parsed.shopperDid;

    super(normalized);
  }

  private get logger(): LogManager {
    return this.opts.logger;
  }

  /**
   * Builds a signed cart mandate.
   * @param contentsInput The cart contents to sign
   * @param extensions Optional extension data
   * @returns Signed cart mandate
   * @throws {SchemaValidationError} If cart contents validation fails
   * @throws {MandateBuildError} If mandate building fails
   */
  async build(contentsInput: CartContents, extensions?: string[]): Promise<CartMandate> {
    this.logger.debug("Building cart mandate", { cartId: contentsInput.id });

    try {
      const contents = CartContentsSchema.parse(contentsInput);
      const ext = extensions ? z.array(z.string()).parse(extensions) : undefined;
      const hash = cartHash(contents);

      const signerConfig: SignerConfig = {
        privateKeyPem: this.opts.merchantPrivateKeyPem,
        algorithm: this.opts.algorithm,
        issuer: this.opts.merchantDid,
        ttlSeconds: this.opts.ttlSeconds,
      };

      if (this.opts.shopperDid) signerConfig.audience = this.opts.shopperDid;
      if (this.opts.merchantKid) signerConfig.keyId = this.opts.merchantKid;

      const jws = await this.sign(
        {
          typ: "JWT",
          cart_hash: hash,
          contents: JSON.parse(jcs(contents)),
        },
        signerConfig,
      );

      const mandate = CartMandateSchema.parse({ contents, merchant_authorization: jws, extensions: ext });
      this.logger.info("Cart mandate built successfully", { cartId: contentsInput.id });
      return mandate;
    } catch (error) {
      this.logger.error("Failed to build cart mandate", error as Error, { cartId: contentsInput.id });
      if (error instanceof z.ZodError) {
        throw new SchemaValidationError("CartContents", error.message);
      }
      if (error instanceof MandateBuildError || error instanceof SchemaValidationError) {
        throw error;
      }
      throw new MandateBuildError("cart", (error as Error).message);
    }
  }
}

/**
 * Factory function to create a CartMandateBuilder instance.
 *
 * @param options - Configuration options for the builder
 * @returns A new CartMandateBuilder instance
 *
 * @example
 * ```typescript
 * import { createCartMandateBuilder } from "anp-ts";
 *
 * const builder = createCartMandateBuilder({
 *   merchantPrivateKeyPem: await fs.readFile("merchant-key.pem", "utf8"),
 *   merchantDid: "did:wba:example:merchant123",
 *   shopperDid: "did:wba:example:user456", // Optional: restrict to specific user
 * });
 * ```
 */
export function createCartMandateBuilder(options: CartMandateBuilderOptions): CartMandateBuilder {
  return new CartMandateBuilder(options);
}


