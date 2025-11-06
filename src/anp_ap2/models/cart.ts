import { z } from "zod";

import { PaymentRequestSchema } from "./payment_request.js";

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


