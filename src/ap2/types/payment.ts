/**
 * Payment Mandate Types
 * 
 * Types for Payment Mandate protocol flow (TA → MA → TA).
 */

import { z } from "zod";
import { PaymentDetailsTotalSchema, PaymentResponseSchema } from "./common.js";

// ============================================
// Payment Mandate Contents
// ============================================

export const PaymentMandateContentsSchema = z.object({
  payment_mandate_id: z.string().describe("Payment mandate ID"),
  payment_details_id: z.string().describe("Must equal CartMandate.payment_request.details.id"),
  payment_details_total: PaymentDetailsTotalSchema,
  payment_response: PaymentResponseSchema,
  merchant_agent: z.string().describe("Merchant agent identifier"),
  timestamp: z.string().describe("ISO-8601 timestamp"),
});
export type PaymentMandateContents = z.infer<typeof PaymentMandateContentsSchema>;

// ============================================
// Payment Mandate Request (TA → MA)
// ============================================

export const PaymentMandateRequestSchema = z.object({
  messageId: z.string().describe("Message unique ID"),
  from: z.string().describe("Sender DID (Shopper)"),
  to: z.string().describe("Recipient DID (Merchant)"),
  
  // ✅ credential_webhook_url at top level (NOT in data)
  credential_webhook_url: z.string().url().describe("Webhook URL for credentials"),
  
  data: z.object({
    payment_mandate_contents: PaymentMandateContentsSchema,
    user_authorization: z.string().describe("User authorization (JWS)"),
  }),
});
export type PaymentMandateRequest = z.infer<typeof PaymentMandateRequestSchema>;

// ============================================
// Payment Mandate Response (MA → TA)
// ============================================

export const PaymentMandateResponseSchema = z.object({
  messageId: z.string().describe("Message unique ID"),
  from: z.string().describe("Sender DID (Merchant)"),
  to: z.string().describe("Recipient DID (Shopper)"),
  data: z.object({
    status: z.enum(["received", "error"]).describe("Response status"),
    payment_mandate_id: z.string().describe("Payment mandate ID"),
    message: z.string().describe("Response message"),
    timestamp: z.string().describe("ISO-8601 timestamp"),
    webhook_confirmed: z.boolean().optional().describe("Webhook URL confirmed"),
    expected_credentials: z.array(z.string()).optional().describe("Expected credential types"),
    // Error fields
    error_code: z.string().optional().describe("Error code if status is error"),
  }),
});
export type PaymentMandateResponse = z.infer<typeof PaymentMandateResponseSchema>;

// ============================================
// Payment Mandate JWS Payload
// ============================================

export const PaymentMandateJWSPayloadSchema = z.object({
  iss: z.string().describe("Issuer DID (Shopper)"),
  aud: z.string().describe("Audience DID (Merchant)"),
  iat: z.number().describe("Issued at (Unix timestamp)"),
  exp: z.number().describe("Expires at (Unix timestamp)"),
  jti: z.string().describe("JWT ID"),
  transaction_data: z.tuple([
    z.string().describe("cart_hash from CartMandate"),
    z.string().describe("pmt_hash = b64url(sha256(JCS(PaymentMandateContents)))"),
  ]),
});
export type PaymentMandateJWSPayload = z.infer<typeof PaymentMandateJWSPayloadSchema>;

// ============================================
// Legacy PaymentMandate (for builders compatibility)
// ============================================

export const PaymentMandateSchema = z.object({
  payment_mandate_contents: PaymentMandateContentsSchema,
  user_authorization: z.string(),
});
export type PaymentMandate = z.infer<typeof PaymentMandateSchema>;
