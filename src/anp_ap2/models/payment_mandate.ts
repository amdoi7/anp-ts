import { z } from "zod";

import { AssetAmountSchema } from "./asset_amount.js";
import { PaymentRequestSchema } from "./payment_request.js";

/**
 * Represents the total amount in payment details, with an optional refund period.
 */
export const SettlementTotalSchema = z.object({
  label: z.string(),
  amount: AssetAmountSchema,
  refund_period: z.number().int().optional(),
});

export type SettlementTotal = z.infer<typeof SettlementTotalSchema>;

/**
 * The response from a payment handler.
 */
export const PaymentResponseSchema = z.object({
  request_id: z.string(),
  method_name: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;

/**
 * The contents of a payment mandate.
 */
export const PaymentMandateContentsSchema = z.object({
  payment_mandate_id: z.string(),
  payment_details_id: z.string(),
  settlement_total: SettlementTotalSchema,
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


