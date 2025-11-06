import { z } from "zod";

export const CrawlerEndpointSchema = z
  .object({
    name: z.string(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
    path: z.string(),
    description: z.string().optional(),
  })
  .strict();

export type CrawlerEndpoint = z.infer<typeof CrawlerEndpointSchema>;

export const CrawlerInterfaceSchema = z
  .object({
    id: z.string(),
    version: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    endpoints: z.array(CrawlerEndpointSchema),
  })
  .catchall(z.unknown());

export type CrawlerInterface = z.infer<typeof CrawlerInterfaceSchema>;

export function validateCrawlerInterface(obj: unknown): CrawlerInterface {
  return CrawlerInterfaceSchema.parse(obj);
}


