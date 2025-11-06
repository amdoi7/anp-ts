import { z } from "zod";

/**
 * Represents a monetary amount with currency and value.
 */
export const MoneyAmountSchema = z.object({
  currency: z.string(),
  value: z.number(),
});
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

/**
 * Represents an item to be displayed in the payment UI.
 */
export const DisplayItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  label: z.string(),
  quantity: z.number().int().positive().default(1),
  amount: MoneyAmountSchema,
});
export type DisplayItem = z.infer<typeof DisplayItemSchema>;

/**
 * Represents the total amount of a payment.
 */
export const PaymentTotalSchema = z.object({
  label: z.string(),
  amount: MoneyAmountSchema,
});
export type PaymentTotal = z.infer<typeof PaymentTotalSchema>;

/**
 * Provides details about a payment, including the items and total.
 */
export const PaymentDetailsSchema = z.object({
  id: z.string(),
  displayItems: z.array(DisplayItemSchema).default([]),
  total: PaymentTotalSchema,
});
export type PaymentDetails = z.infer<typeof PaymentDetailsSchema>;

/**
 * Describes a supported payment method.
 */
export const PaymentMethodDataSchema = z.object({
  supported_methods: z.string(),
  data: z.record(z.any()).optional(),
});
export type PaymentMethodData = z.infer<typeof PaymentMethodDataSchema>;

/**
 * Options for a payment request.
 */
export const PaymentRequestOptionsSchema = z.object({
  requestShipping: z.boolean().optional(),
});
export type PaymentRequestOptions = z.infer<typeof PaymentRequestOptionsSchema>;

/**
 * Defines a payment request, including methods, details, and options.
 */
export const PaymentRequestSchema = z.object({
  method_data: z.array(PaymentMethodDataSchema).default([]),
  details: PaymentDetailsSchema,
  options: PaymentRequestOptionsSchema.optional(),
});
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

/**
 * The contents of a shopping cart, forming the core of a CartMandate.
 */
export const CartContentsSchema = z.object({
  id: z.string(),
  user_signature_required: z.boolean().default(false),
  payment_request: PaymentRequestSchema,
});
export type CartContents = z.infer<typeof CartContentsSchema>;

/**
 * A merchant-signed authorization for a shopping cart's contents.
 */
export const CartMandateSchema = z.object({
  contents: CartContentsSchema,
  merchant_authorization: z.string(),
  extensions: z.array(z.string()).optional(),
});
export type CartMandate = z.infer<typeof CartMandateSchema>;

/**
 * Represents the total amount in payment details, with an optional refund period.
 */
export const PaymentDetailsTotalSchema = z.object({
  label: z.string(),
  amount: MoneyAmountSchema,
  refund_period: z.number().int().optional(),
});
export type PaymentDetailsTotal = z.infer<typeof PaymentDetailsTotalSchema>;

/**
 * The response from a payment handler.
 */
export const PaymentResponseSchema = z.object({
  request_id: z.string(),
  method_name: z.string(),
  details: z.record(z.any()).optional(),
});
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;

/**
 * The contents of a payment mandate.
 */
export const PaymentMandateContentsSchema = z.object({
  payment_mandate_id: z.string(),
  payment_details_id: z.string(),
  payment_details_total: PaymentDetailsTotalSchema,
  payment_response: PaymentResponseSchema,
  merchant_agent: z.string().optional(),
  timestamp: z.string(),
});
export type PaymentMandateContents = z.infer<typeof PaymentMandateContentsSchema>;

/**
 * A user-signed authorization for a payment.
 */
export const PaymentMandateSchema = z.object({
  payment_mandate_contents: PaymentMandateContentsSchema,
  user_authorization: z.string(),
  extensions: z.array(z.string()).optional(),
});
export type PaymentMandate = z.infer<typeof PaymentMandateSchema>;


