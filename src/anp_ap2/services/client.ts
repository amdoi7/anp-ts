import { z } from "zod";

import { type Authenticator } from "@/anp_auth/authenticator.js";
import { defaultHttpClient, type HttpClient } from "@/core/http.js";
import { LogManager, NullLogger } from "@/core/logging.js";

import { DisplayItemSchema, PaymentMandateSchema, type CartMandate, type DisplayItem, type PaymentMandate } from "../models/index.js";
import { AP2_DEFAULTS } from "../constants.js";
import { AP2NetworkError, SchemaValidationError } from "../errors.js";

export interface AP2ClientOptions {
  authenticator: Authenticator;
  httpClient?: HttpClient;
  logger?: LogManager;
  /**
   * Custom endpoint paths for AP2 operations.
   * Defaults to standard AP2 paths if not provided.
   */
  endpoints?: {
    createCartMandate?: string;
    paymentMandate?: string;
  };
}

export interface SendPaymentMandateResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * HTTP client for AP2 protocol interactions.
 *
 * Handles communication with AP2-enabled merchants, including:
 * - Creating cart mandates via merchant API
 * - Sending payment mandates to merchants
 * - Automatic DID authentication via Authenticator
 *
 * @example
 * ```typescript
 * import { ap2, Authenticator } from "anp-ts";
 *
 * const authenticator = Authenticator.init({
 *   did: "did:wba:example:user",
 *   privateKey: userJwk,
 * });
 *
 * const client = ap2.services.createAp2Client({
 *   authenticator,
 * });
 *
 * // Request a cart mandate from merchant
 * const cartMandate = await client.createCartMandate({
 *   merchantUrl: "https://merchant.example.com",
 *   merchantDid: "did:wba:example:merchant",
 *   cartMandateId: "cart-001",
 *   items: [
 *     { label: "Product A", amount: { currency: "USD", value: "99.99" } }
 *   ],
 * });
 * ```
 */
export class AP2Client {
  private readonly http: HttpClient;
  private readonly auth: Authenticator;
  private readonly logger: LogManager;
  private readonly endpoints: {
    createCartMandate: string;
    paymentMandate: string;
  };

  constructor(opts: AP2ClientOptions) {
    this.http = opts.httpClient ?? defaultHttpClient;
    this.auth = opts.authenticator;
    this.logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "AP2Client" });
    this.endpoints = {
      createCartMandate: opts.endpoints?.createCartMandate ?? AP2_DEFAULTS.ENDPOINTS.CREATE_CART_MANDATE,
      paymentMandate: opts.endpoints?.paymentMandate ?? AP2_DEFAULTS.ENDPOINTS.PAYMENT_MANDATE,
    };
    this.logger.info("AP2Client initialized", { endpoints: this.endpoints });
  }

  /**
   * Creates a cart mandate by requesting it from the merchant.
   * @throws {SchemaValidationError} If params validation fails
   * @throws {AP2NetworkError} If HTTP request fails
   */
  async createCartMandate(params: {
    merchantUrl: string;
    merchantDid: string;
    cartMandateId: string;
    items: DisplayItem[];
    shippingAddress?: Record<string, unknown>;
    remark?: string;
  }): Promise<CartMandate> {
    this.logger.debug("Creating cart mandate request", { cartMandateId: params.cartMandateId, merchantUrl: params.merchantUrl });

      const Schema = z.object({
      merchantUrl: z.string().url(),
      merchantDid: z.string().min(1),
      cartMandateId: z.string().min(1),
        items: z.array(DisplayItemSchema),
      shippingAddress: z.record(z.string(), z.unknown()).optional(),
        remark: z.string().optional(),
      });

    let p;
    try {
      p = Schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new SchemaValidationError("CreateCartMandateParams", error.message);
      }
      throw error;
    }

    const url = new URL(this.endpoints.createCartMandate, p.merchantUrl).toString();

    try {
      const authHeader = await this.auth.createAuthorizationHeader(url, "POST");
      const res = await this.http.request<CartMandate>(url, "POST", {
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: {
          merchant_did: p.merchantDid,
          cart_mandate_id: p.cartMandateId,
          items: p.items,
          shipping_address: p.shippingAddress,
          remark: p.remark,
        },
      });
      this.logger.info("Cart mandate created successfully", { cartMandateId: p.cartMandateId });
      return res.data;
    } catch (error) {
      const cartMandateId = params.cartMandateId || "unknown";
      const merchantUrl = params.merchantUrl || "unknown";
      this.logger.error("Failed to create cart mandate", error as Error, { cartMandateId, merchantUrl });
      if (error instanceof AP2NetworkError || error instanceof SchemaValidationError) {
      throw error;
    }
      throw new AP2NetworkError(url, undefined, (error as Error).message);
    }
  }

  /**
   * Sends a payment mandate to the merchant.
   * @throws {SchemaValidationError} If params validation fails
   * @throws {AP2NetworkError} If HTTP request fails
   */
  async sendPaymentMandate(params: { merchantUrl: string; merchantDid: string; paymentMandate: PaymentMandate }): Promise<SendPaymentMandateResponse> {
    this.logger.debug("Sending payment mandate", {
      paymentMandateId: params.paymentMandate.payment_mandate_contents.payment_mandate_id,
      merchantUrl: params.merchantUrl,
    });

      const Schema = z.object({
      merchantUrl: z.string().url(),
      merchantDid: z.string().min(1),
      paymentMandate: PaymentMandateSchema,
      });

    let p;
    try {
      p = Schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new SchemaValidationError("SendPaymentMandateParams", error.message);
      }
      throw error;
    }

    const url = new URL(this.endpoints.paymentMandate, p.merchantUrl).toString();

    try {
      const authHeader = await this.auth.createAuthorizationHeader(url, "POST");
      const res = await this.http.request<SendPaymentMandateResponse>(url, "POST", {
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: {
          merchant_did: p.merchantDid,
          payment_mandate: p.paymentMandate,
        },
      });
      this.logger.info("Payment mandate sent successfully", {
        paymentMandateId: p.paymentMandate.payment_mandate_contents.payment_mandate_id,
      });
      return res.data;
    } catch (error) {
      this.logger.error("Failed to send payment mandate", error as Error, {
        paymentMandateId: params.paymentMandate.payment_mandate_contents.payment_mandate_id,
        merchantUrl: params.merchantUrl,
      });
      if (error instanceof AP2NetworkError || error instanceof SchemaValidationError) {
      throw error;
      }
      throw new AP2NetworkError(url, undefined, (error as Error).message);
    }
  }
}

export function createAp2Client(options: AP2ClientOptions): AP2Client {
  return new AP2Client(options);
}


