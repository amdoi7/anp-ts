import { z } from "zod";

import { DisplayItemSchema } from "./display.js";
import { PaymentTotalSchema } from "./display.js";

/**
 * Provides details about a payment, including the items and total.
 */
export const PaymentDetailsSchema = z.object({
  id: z.string(),
  displayItems: z.array(DisplayItemSchema).default([]),
  total: PaymentTotalSchema,
});

export type PaymentDetails = z.infer<typeof PaymentDetailsSchema>;


