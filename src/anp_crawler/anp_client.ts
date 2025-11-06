import { defaultHttpClient, type HttpClient } from "@/core/http.js";
import { parseAnpInterface } from "@/anp_crawler/anp_parser.js";
import type { AnpInterface } from "@/anp_crawler/anp_interface.js";
import { AnpCrawlerError } from "./errors.js";
import { LogManager, NullLogger } from "@/core/logging.js";

/**
 * Options for configuring the AnpCrawlerClient.
 */
export interface CrawlerOptions {
  httpClient?: HttpClient;
  /**
   * An optional logger instance.
   * Defaults to a NullLogger which does nothing.
   */
  logger?: LogManager;
}

export class AnpCrawlerClient {
  private http: HttpClient;
  private readonly logger: LogManager;

  constructor(opts: CrawlerOptions = {}) {
    this.http = opts.httpClient ?? defaultHttpClient;

    this.logger = (opts.logger ?? new LogManager(new NullLogger())).withContext({ module: "AnpCrawlerClient" });
    this.logger.info("AnpCrawlerClient initialized");
  }

  async fetchInterface(url: string): Promise<AnpInterface> {
    this.logger.debug("Fetching ANP interface", { url });
    try {
      const res = await this.http.request(url, "GET", { headers: { Accept: "application/json" } });
      this.logger.debug("Received response from interface endpoint", { url, status: res.status });

      let dataToParse: unknown;
      if (typeof res.data === "string") {
        const text = res.data.trim();
        if (!text) {
          this.logger.warn("Received empty response for ANP interface", { url });
          throw new AnpCrawlerError(`Empty response from ${url}`);
        }
        dataToParse = JSON.parse(text);
        this.logger.debug("Parsed string response to JSON", { url });
      } else {
        dataToParse = res.data;
      }

      const anpInterface = parseAnpInterface(dataToParse);
      this.logger.info("Successfully fetched and parsed ANP interface", { url, interfaceId: anpInterface.id });
      return anpInterface;
    } catch (e: any) {
      if (e instanceof AnpCrawlerError) {
        this.logger.error("Failed to fetch or parse ANP interface", e, { url });
        throw e;
      }
      const message = e?.message ?? String(e);
      this.logger.error("An unexpected error occurred while fetching/parsing ANP interface", e, { url });
      throw new AnpCrawlerError(`Failed to fetch or parse interface from ${url}: ${message}`);
    }
  }
}

export function createCrawler(opts: CrawlerOptions = {}): AnpCrawlerClient {
  return new AnpCrawlerClient(opts);
}
