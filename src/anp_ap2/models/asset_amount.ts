import { z } from "zod";

/**
 * Represents the value of a transferable asset (token, coin, fiat) with denomination and quantity.
 * Follows Web Payment API naming conventions.
 */
export const AssetAmountSchema = z.object({
  currency: z.string(),
  value: z.string(), // String to avoid floating point precision issues
});

export type AssetAmount = z.infer<typeof AssetAmountSchema>;


