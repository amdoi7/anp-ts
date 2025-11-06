import { defaultHttpClient, type HttpClient } from "@/core/http.js";
import { type Authenticator } from "@/anp_auth/authenticator.js";
import { z } from "zod";
import {
  type CartMandate,
  type PaymentMandate,
  type DisplayItem,
  DisplayItemSchema,
  PaymentMandateSchema,
} from "./models.js";
import { LogManager, NullLogger } from "@/core/logging.js";

/**
 * Options for configuring the AP2Client.
 */
export interface AP2ClientOptions {
  /** The authenticator instance to use for signing requests. */
  authenticator: Authenticator;
  /** An optional HTTP client to use for making requests. */
  httpClient?: HttpClient;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

/**
 * The response from the `send_payment_mandate` method.
 */
export interface SendPaymentMandateResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * A client for interacting with an AP2-compliant merchant server.
 */
export class AP2Client {
  private readonly http: HttpClient;
  private readonly auth: Authenticator;
  private readonly logger: LogManager;

  /**
   * @param opts - The options for configuring the client.
   */
  constructor(opts: AP2ClientOptions) {
    this.http = opts.httpClient ?? defaultHttpClient;
    this.auth = opts.authenticator;

    this.logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "AP2Client" });
    this.logger.info("AP2Client initialized");
  }

  /**
   * Requests a new CartMandate from the merchant.
   * @param params - The parameters for creating the cart mandate.
   * @returns A promise that resolves to the created CartMandate.
   */
  async create_cart_mandate(params: {
    merchant_url: string;
    merchant_did: string;
    cart_mandate_id: string;
    items: DisplayItem[];
    shipping_address?: Record<string, unknown>;
    remark?: string;
  }): Promise<CartMandate> {
    this.logger.debug("Creating cart mandate request", { cart_mandate_id: params.cart_mandate_id, merchant_url: params.merchant_url });
    try {
      const Schema = z.object({
        merchant_url: z.string().url(),
        merchant_did: z.string().min(1),
        cart_mandate_id: z.string().min(1),
        items: z.array(DisplayItemSchema),
        shipping_address: z.record(z.unknown()).optional(),
        remark: z.string().optional(),
      });
      const p = Schema.parse(params);
      const url = new URL("/ap2/create_cart_mandate", p.merchant_url).toString();
      const authHeader = await this.auth.createAuthorizationHeader(url, "POST");
      const res = await this.http.request(url, "POST", {
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: {
          merchant_did: p.merchant_did,
          cart_mandate_id: p.cart_mandate_id,
          items: p.items,
          shipping_address: p.shipping_address,
          remark: p.remark,
        },
      });
      this.logger.info("Cart mandate created successfully", { cart_mandate_id: p.cart_mandate_id });
      return res.data as CartMandate;
    } catch (error: any) {
      this.logger.error("Failed to create cart mandate", error, { cart_mandate_id: params.cart_mandate_id, merchant_url: params.merchant_url });
      throw error;
    }
  }

  /**
   * Sends a signed PaymentMandate to the merchant for processing.
   * @param params - The parameters for sending the payment mandate.
   * @returns A promise that resolves to the merchant's response.
   */
  async send_payment_mandate(params: {
    merchant_url: string;
    merchant_did: string;
    payment_mandate: PaymentMandate;
  }): Promise<SendPaymentMandateResponse> {
    this.logger.debug("Sending payment mandate", { payment_mandate_id: params.payment_mandate.payment_mandate_contents.payment_mandate_id, merchant_url: params.merchant_url });
    try {
      const Schema = z.object({
        merchant_url: z.string().url(),
        merchant_did: z.string().min(1),
        payment_mandate: PaymentMandateSchema,
      });
      const p = Schema.parse(params);
      const url = new URL("/ap2/payment_mandate", p.merchant_url).toString();
      const authHeader = await this.auth.createAuthorizationHeader(url, "POST");
      const res = await this.http.request(url, "POST", {
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: {
          merchant_did: p.merchant_did,
          payment_mandate: p.payment_mandate,
        },
      });
      this.logger.info("Payment mandate sent successfully", { payment_mandate_id: p.payment_mandate.payment_mandate_contents.payment_mandate_id });
      return res.data as SendPaymentMandateResponse;
    } catch (error: any) {
      this.logger.error("Failed to send payment mandate", error, { payment_mandate_id: params.payment_mandate.payment_mandate_contents.payment_mandate_id, merchant_url: params.merchant_url });
      throw error;
    }
  }
}


