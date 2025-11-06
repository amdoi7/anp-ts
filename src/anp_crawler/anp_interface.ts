import { z } from "zod";

/**
 * Defines a single endpoint within an ANP interface.
 */
export const AnpEndpointSchema = z
  .object({
    name: z.string(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
    path: z.string(),
    description: z.string().optional(),
  })
  .strict();

export type AnpEndpoint = z.infer<typeof AnpEndpointSchema>;

/**
 * Defines the schema for an ANP (Agentic Networking Protocol) interface.
 * The `.catchall(z.unknown())` is used to allow for forward compatibility,
 * permitting unknown fields to be present in the interface definition without
 * causing validation to fail.
 */
export const AnpInterfaceSchema = z
  .object({
    id: z.string(),
    version: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    endpoints: z.array(AnpEndpointSchema),
  })
  .catchall(z.unknown());

export type AnpInterface = z.infer<typeof AnpInterfaceSchema>;

/**
 * Validates an object against the AnpInterfaceSchema.
 * @param obj - The object to validate.
 * @returns The validated AnpInterface object.
 * @throws {ZodError} if validation fails.
 */
export function validateAnpInterface(obj: unknown): AnpInterface {
  return AnpInterfaceSchema.parse(obj);
}
