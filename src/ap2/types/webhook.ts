/**
 * Webhook Credential Types
 * 
 * Types for webhook credential push (MA → TA via webhook).
 */

import { z } from "zod";
import { MoneyAmountSchema } from "./common.js";

// ============================================
// Payment Receipt
// ============================================

export const PaymentReceiptContentsSchema = z.object({
  payment_mandate_id: z.string().describe("Payment mandate ID"),
  provider: z.enum(["ALIPAY", "WECHAT"]).describe("Payment provider"),
  status: z.enum(["SUCCEEDED", "FAILED", "PENDING"]).describe("Payment status"),
  transaction_id: z.string().describe("Provider transaction ID"),
  out_trade_no: z.string().describe("External trade number"),
  paid_at: z.string().describe("Payment time in ISO-8601"),
  amount: MoneyAmountSchema.describe("Payment amount"),
});
export type PaymentReceiptContents = z.infer<typeof PaymentReceiptContentsSchema>;

export const PaymentReceiptSchema = z.object({
  credential_type: z.literal("PaymentReceipt"),
  version: z.number().default(1).describe("Credential version"),
  id: z.string().describe("Credential unique ID"),
  timestamp: z.string().describe("ISO-8601 timestamp"),
  contents: PaymentReceiptContentsSchema,
  merchant_authorization: z.string().describe("Merchant authorization signature (JWS)"),
});
export type PaymentReceipt = z.infer<typeof PaymentReceiptSchema>;

// ============================================
// Fulfillment Receipt
// ============================================

export const FulfillmentReceiptContentsSchema = z.object({
  order_id: z.string().describe("Order ID"),
  items: z.array(z.object({
    id: z.string().describe("Item ID"),
    quantity: z.number().describe("Fulfilled quantity"),
  })),
  fulfilled_at: z.string().describe("Fulfillment time in ISO-8601"),
  shipping: z.object({
    carrier: z.string().describe("Shipping carrier"),
    tracking_number: z.string().describe("Tracking number"),
    delivered_eta: z.string().describe("Expected delivery time in ISO-8601"),
  }).optional(),
});
export type FulfillmentReceiptContents = z.infer<typeof FulfillmentReceiptContentsSchema>;

export const FulfillmentReceiptSchema = z.object({
  credential_type: z.literal("FulfillmentReceipt"),
  version: z.number().default(1).describe("Credential version"),
  id: z.string().describe("Credential unique ID"),
  timestamp: z.string().describe("ISO-8601 timestamp"),
  contents: FulfillmentReceiptContentsSchema,
  merchant_authorization: z.string().describe("Merchant authorization signature (JWS)"),
});
export type FulfillmentReceipt = z.infer<typeof FulfillmentReceiptSchema>;

// ============================================
// Webhook Credential JWS Payload
// ============================================

export const WebhookCredentialJWSPayloadSchema = z.object({
  iss: z.string().describe("Issuer DID (Merchant)"),
  aud: z.string().describe("Audience DID (Shopper)"),
  iat: z.number().describe("Issued at (Unix timestamp)"),
  exp: z.number().describe("Expires at (Unix timestamp)"),
  jti: z.string().describe("JWT ID (same as credential.id)"),
  credential_type: z.enum(["PaymentReceipt", "FulfillmentReceipt"]),
  transaction_data: z.tuple([
    z.string().describe("cart_hash from CartMandate"),
    z.string().describe("pmt_hash from PaymentMandate"),
    z.string().describe("cred_hash = b64url(sha256(JCS(contents)))"),
  ]),
});
export type WebhookCredentialJWSPayload = z.infer<typeof WebhookCredentialJWSPayloadSchema>;

// ============================================
// Webhook Response (TA → MA)
// ============================================

export const WebhookResponseSchema = z.object({
  status: z.enum(["received", "already_received", "error"]).describe("Response status"),
  credential_id: z.string().describe("Credential ID"),
  received_at: z.string().describe("ISO-8601 timestamp").optional(),
  first_received_at: z.string().describe("First received time (for already_received)").optional(),
  error_code: z.string().optional().describe("Error code if status is error"),
  message: z.string().optional().describe("Error message if status is error"),
});
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;

// ============================================
// Union Types
// ============================================

export const CredentialSchema = z.discriminatedUnion("credential_type", [
  PaymentReceiptSchema,
  FulfillmentReceiptSchema,
]);
export type Credential = z.infer<typeof CredentialSchema>;
