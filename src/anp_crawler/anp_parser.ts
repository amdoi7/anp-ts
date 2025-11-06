import { AnpInterfaceSchema, type AnpInterface } from "@/anp_crawler/anp_interface.js";
import { z } from "zod";

// Schema for the shape: { name, tools: [...] }
const Shape1Schema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  tools: z.array(
    z
      .object({
        name: z.string().optional(),
        method: z.string().optional(),
        path: z.string().optional(),
        description: z.string().optional(),
      })
      .catchall(z.unknown())
  ),
});

// Schema for the shape: { interface: { id, endpoints } }
const Shape2Schema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  interface: z
    .object({
      id: z.string().optional(),
      endpoints: z.array(z.unknown()).optional(),
    })
    .catchall(z.unknown()),
});

// Schema for the shape: { id, methods: [...] }
const Shape3Schema = z.object({
  id: z.string().optional(),
  methods: z.array(
    z
      .object({
        name: z.string().optional(),
        method: z.string().optional(),
        route: z.string().optional(),
        description: z.string().optional(),
      })
      .catchall(z.unknown())
  ),
});

const NormalizingSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object") return input;

    // Shape 1: { name, tools: [...] }
    const shape1 = Shape1Schema.safeParse(input);
    if (shape1.success) {
      const { id, name, tools } = shape1.data;
      return {
        id: id ?? name ?? "unknown",
        endpoints: tools.map((t) => ({
          name: t.name ?? "tool",
          method: (t.method ?? "POST").toUpperCase(),
          path: t.path ?? `/tools/${t.name ?? "invoke"}`,
          description: t.description,
        })),
      };
    }

    // Shape 2: { interface: { id, endpoints } }
    const shape2 = Shape2Schema.safeParse(input);
    if (shape2.success) {
      const { id, name, interface: iface } = shape2.data;
      return {
        id: iface.id ?? id ?? name ?? "unknown",
        endpoints: iface.endpoints ?? [],
      };
    }

    // Shape 3: { id, methods: [...] }
    const shape3 = Shape3Schema.safeParse(input);
    if (shape3.success) {
      const { id, methods } = shape3.data;
      return {
        id: id ?? "unknown",
        endpoints: methods.map((m) => ({
          name: m.name ?? "method",
          method: (m.method ?? "GET").toUpperCase(),
          path: m.route ?? `/${m.name ?? "invoke"}`,
          description: m.description,
        })),
      };
    }

    // If it doesn't match any known shape, pass it through
    return input;
  },
  AnpInterfaceSchema
);

/**
 * Parses an unknown input into a validated AnpInterface object.
 * It attempts to normalize common alternative shapes into the standard AnpInterface shape.
 * @param input - The unknown input, expected to be an object representing an ANP interface.
 * @returns A validated AnpInterface object.
 * @throws {ZodError} if the input cannot be parsed into a valid AnpInterface.
 */
export function parseAnpInterface(input: unknown): AnpInterface {
  return NormalizingSchema.parse(input);
}
