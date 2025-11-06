import { z } from "zod";

import { CrawlerInterfaceSchema, type CrawlerInterface, CrawlerEndpointSchema, type CrawlerEndpoint } from "../models/interface.js";

const ShapeToolsSchema = z.object({
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
      .catchall(z.unknown()),
  ),
});

const ShapeInterfaceWrapperSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  interface: z
    .object({
      id: z.string().optional(),
      endpoints: z.array(z.unknown()).optional(),
    })
    .catchall(z.unknown()),
});

const ShapeMethodsSchema = z.object({
  id: z.string().optional(),
  methods: z.array(
    z
      .object({
        name: z.string().optional(),
        method: z.string().optional(),
        route: z.string().optional(),
        description: z.string().optional(),
      })
      .catchall(z.unknown()),
  ),
});

const NormalizingSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object") return input;

    const toolsShape = ShapeToolsSchema.safeParse(input);
    if (toolsShape.success) {
      const { id, name, tools } = toolsShape.data;
      const endpoints = tools.map((tool) => {
        const method = (tool.method ?? "POST").toUpperCase() as CrawlerEndpoint["method"];
        return {
          name: tool.name ?? "tool",
          method,
          path: tool.path ?? `/tools/${tool.name ?? "invoke"}`,
          description: tool.description,
        } satisfies CrawlerEndpoint;
      });

      return {
        id: id ?? name ?? "unknown",
        endpoints,
      } satisfies CrawlerInterface;
    }

    const wrapperShape = ShapeInterfaceWrapperSchema.safeParse(input);
    if (wrapperShape.success) {
      const { id, name, interface: iface } = wrapperShape.data;
      const endpoints = (iface.endpoints ?? []).map((endpoint) => CrawlerEndpointSchema.parse(endpoint));

      return {
        id: iface.id ?? id ?? name ?? "unknown",
        endpoints,
      } satisfies CrawlerInterface;
    }

    const methodsShape = ShapeMethodsSchema.safeParse(input);
    if (methodsShape.success) {
      const { id, methods } = methodsShape.data;
      const endpoints = methods.map((m) => {
        const method = (m.method ?? "GET").toUpperCase() as CrawlerEndpoint["method"];
        return {
          name: m.name ?? "method",
          method,
          path: m.route ?? `/${m.name ?? "invoke"}`,
          description: m.description,
        } satisfies CrawlerEndpoint;
      });

      return {
        id: id ?? "unknown",
        endpoints,
      } satisfies CrawlerInterface;
    }

    return input;
  },
  CrawlerInterfaceSchema,
);

export function parseCrawlerInterface(input: unknown): CrawlerInterface {
  return NormalizingSchema.parse(input);
}


