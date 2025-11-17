/**
 * Common Types
 * 
 * Shared types used across all AP2 protocol modules.
 */

import { z } from "zod";

// ============================================
// Money and Amount Types
// ============================================

export const MoneyAmountSchema = z.object({
  currency: z.string().describe("Currency code, e.g., CNY, USD"),
  value: z.number().describe("Decimal amount value"),
});
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

// ============================================
// Display Item Types
// ============================================

export const DisplayItemSchema = z.object({
  id: z.string().describe("Item unique identifier"),
  sku: z.string().describe("Item SKU"),
  label: z.string().describe("Item display name"),
  quantity: z.number().describe("Item quantity"),
  options: z.record(z.string(), z.string()).optional().nullable().describe("Item options (color, size)"),
  amount: MoneyAmountSchema.describe("Item amount"),
  pending: z.boolean().optional().nullable().describe("Whether pending"),
  remark: z.string().optional().nullable().describe("Remark"),
});
export type DisplayItem = z.infer<typeof DisplayItemSchema>;

// ============================================
// Address Types
// ============================================

export const ShippingAddressSchema = z.object({
  recipient_name: z.string().describe("Recipient name"),
  phone: z.string().describe("Contact phone"),
  region: z.string().describe("Province / Region"),
  city: z.string().describe("City"),
  address_line: z.string().describe("Detailed address"),
  postal_code: z.string().describe("Postal code"),
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

// ============================================
// Payment Method Types
// ============================================

export const QRCodePaymentDataSchema = z.object({
  channel: z.enum(["ALIPAY", "WECHAT"]).describe("Payment channel"),
  qr_url: z.string().describe("QR Code URL"),
  out_trade_no: z.string().describe("External trade number"),
  expires_at: z.string().describe("Expiration time in ISO-8601"),
});
export type QRCodePaymentData = z.infer<typeof QRCodePaymentDataSchema>;

export const PaymentMethodDataSchema = z.object({
  supported_methods: z.literal("QR_CODE").describe("Supported payment method"),
  data: QRCodePaymentDataSchema,
});
export type PaymentMethodData = z.infer<typeof PaymentMethodDataSchema>;

// ============================================
// Payment Details Types
// ============================================

export const PaymentDetailsSchema = z.object({
  id: z.string().describe("Order unique identifier"),
  displayItems: z.array(DisplayItemSchema).describe("Display item list"),
  shipping_address: ShippingAddressSchema.optional().nullable(),
  shipping_options: z.unknown().optional().nullable(),
  modifiers: z.unknown().optional().nullable(),
  total: z.object({
    label: z.string(),
    amount: MoneyAmountSchema,
    pending: z.boolean().optional().nullable(),
  }),
});
export type PaymentDetails = z.infer<typeof PaymentDetailsSchema>;

export const PaymentDetailsTotalSchema = z.object({
  label: z.string(),
  amount: MoneyAmountSchema,
  pending: z.boolean().optional().nullable(),
  refund_period: z.number().describe("Refund period (days)").optional(),
});
export type PaymentDetailsTotal = z.infer<typeof PaymentDetailsTotalSchema>;

// ============================================
// Payment Request Types
// ============================================

export const PaymentRequestOptionsSchema = z.object({
  requestPayerName: z.boolean(),
  requestPayerEmail: z.boolean(),
  requestPayerPhone: z.boolean(),
  requestShipping: z.boolean(),
  shippingType: z.string().nullable().optional(),
});
export type PaymentRequestOptions = z.infer<typeof PaymentRequestOptionsSchema>;

export const PaymentRequestSchema = z.object({
  method_data: z.array(PaymentMethodDataSchema),
  details: PaymentDetailsSchema,
  options: PaymentRequestOptionsSchema,
});
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

// ============================================
// Payment Response Types
// ============================================

export const PaymentResponseSchema = z.object({
  request_id: z.string(),
  method_name: z.literal("QR_CODE"),
  details: z.object({
    channel: z.enum(["ALIPAY", "WECHAT"]),
    out_trade_no: z.string(),
  }),
  shipping_address: ShippingAddressSchema.optional().nullable(),
  shipping_option: z.unknown().optional().nullable(),
  payer_name: z.string().optional().nullable(),
  payer_email: z.string().optional().nullable(),
  payer_phone: z.string().optional().nullable(),
});
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
