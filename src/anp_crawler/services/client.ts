import { defaultHttpClient, type HttpClient } from "@/core/http.js";
import { LogManager, NullLogger } from "@/core/logging.js";

import { AnpCrawlerError } from "../errors.js";
import { parseCrawlerInterface } from "../parsers/interface_parser.js";
import type { CrawlerInterface } from "../models/interface.js";

export interface CrawlerClientOptions {
  httpClient?: HttpClient;
  logger?: LogManager;
}

export class CrawlerClient {
  private readonly http: HttpClient;
  private readonly logger: LogManager;

  constructor(options: CrawlerClientOptions = {}) {
    this.http = options.httpClient ?? defaultHttpClient;
    this.logger = (options.logger ?? new LogManager(new NullLogger())).withContext({ module: "CrawlerClient" });
    this.logger.info("CrawlerClient initialized");
  }

  async fetchInterface(url: string): Promise<CrawlerInterface> {
    this.logger.debug("Fetching ANP interface", { url });
    try {
      const res = await this.http.request(url, "GET", { headers: { Accept: "application/json" } });
      this.logger.debug("Received response from interface endpoint", { url, status: res.status });

      const payload = typeof res.data === "string" ? this.parseJson(res.data, url) : res.data;
      const iface = parseCrawlerInterface(payload);
      this.logger.info("Successfully fetched and parsed ANP interface", { url, interfaceId: iface.id });
      return iface;
    } catch (error) {
      if (error instanceof AnpCrawlerError) {
        this.logger.error("Failed to fetch or parse ANP interface", error, { url });
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Unexpected crawler failure", error as Error, { url });
      throw new AnpCrawlerError(`Failed to fetch or parse interface from ${url}: ${message}`);
    }
  }

  private parseJson(payload: string, url: string): unknown {
    const trimmed = payload.trim();
    if (!trimmed) {
      this.logger.warn("Received empty response for ANP interface", { url });
      throw new AnpCrawlerError(`Empty response from ${url}`);
    }
    const parsed = JSON.parse(trimmed);
    this.logger.debug("Parsed string response to JSON", { url });
    return parsed;
  }
}

export function createCrawlerClient(options: CrawlerClientOptions = {}): CrawlerClient {
  return new CrawlerClient(options);
}

export async function fetchCrawlerInterface(url: string, options: CrawlerClientOptions = {}): Promise<CrawlerInterface> {
  const client = createCrawlerClient(options);
  return client.fetchInterface(url);
}


