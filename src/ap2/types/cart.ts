/**
 * Cart Mandate Types
 * 
 * Types for Cart Mandate protocol flow (TA → MA → TA).
 */

import { z } from "zod";
import { PaymentRequestSchema, DisplayItemSchema, ShippingAddressSchema } from "./common.js";

// ============================================
// Cart Contents
// ============================================

export const CartContentsSchema = z.object({
  id: z.string().describe("Cart unique identifier"),
  user_signature_required: z.boolean(),
  payment_request: PaymentRequestSchema,
});
export type CartContents = z.infer<typeof CartContentsSchema>;

// ============================================
// Cart Mandate Request (TA → MA)
// ============================================

export const CartMandateRequestSchema = z.object({
  messageId: z.string().describe("Message unique ID"),
  from: z.string().describe("Sender DID (Shopper)"),
  to: z.string().describe("Recipient DID (Merchant)"),
  data: z.object({
    cart_mandate_id: z.string().describe("Cart mandate ID"),
    items: z.array(DisplayItemSchema).describe("Cart items"),
    shipping_address: ShippingAddressSchema.optional().describe("Shipping address"),
  }),
});
export type CartMandateRequest = z.infer<typeof CartMandateRequestSchema>;

// ============================================
// Cart Mandate Response (MA → TA)
// ============================================

export const CartMandateResponseSchema = z.object({
  messageId: z.string().describe("Message unique ID"),
  from: z.string().describe("Sender DID (Merchant)"),
  to: z.string().describe("Recipient DID (Shopper)"),
  data: z.object({
    contents: CartContentsSchema,
    merchant_authorization: z.string().describe("Merchant authorization (JWS)"),
    timestamp: z.string().describe("ISO-8601 timestamp"),
  }),
});
export type CartMandateResponse = z.infer<typeof CartMandateResponseSchema>;

// ============================================
// Cart Mandate JWS Payload
// ============================================

export const CartMandateJWSPayloadSchema = z.object({
  iss: z.string().describe("Issuer DID (Merchant)"),
  aud: z.string().describe("Audience DID (Shopper)"),
  iat: z.number().describe("Issued at (Unix timestamp)"),
  exp: z.number().describe("Expires at (Unix timestamp)"),
  jti: z.string().describe("JWT ID"),
  cart_hash: z.string().describe("Hash of cart contents: b64url(sha256(JCS(contents)))"),
});
export type CartMandateJWSPayload = z.infer<typeof CartMandateJWSPayloadSchema>;

// ============================================
// Legacy CartMandate (for builders compatibility)
// ============================================

export const CartMandateSchema = z.object({
  contents: CartContentsSchema,
  merchant_authorization: z.string(),
  timestamp: z.string().optional(),
});
export type CartMandate = z.infer<typeof CartMandateSchema>;
