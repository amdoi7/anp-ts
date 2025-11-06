import { z } from "zod";

import { AssetAmountSchema } from "./asset_amount.js";

/**
 * Represents an item to be displayed in the payment UI.
 */
export const DisplayItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  label: z.string(),
  quantity: z.number().int().positive().optional().default(1),
  amount: AssetAmountSchema,
});

export type DisplayItem = z.infer<typeof DisplayItemSchema>;

/**
 * Represents the total amount of a payment.
 */
export const PaymentTotalSchema = z.object({
  label: z.string(),
  amount: AssetAmountSchema,
});

export type PaymentTotal = z.infer<typeof PaymentTotalSchema>;


