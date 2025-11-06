import { z } from "zod";

import { PaymentDetailsSchema } from "./payment_details.js";

/**
 * Describes a supported payment method.
 */
export const PaymentMethodDataSchema = z.object({
  supported_methods: z.string(),
  data: z.record(z.string(), z.any()).optional(),
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


