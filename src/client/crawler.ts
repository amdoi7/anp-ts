/**
 * ANP Interface Crawler Client
 * 
 * Fetches and parses ANP interface definitions.
 * Fail Fast: Errors thrown immediately.
 * 
 * @packageDocumentation
 */

import type { HttpClient } from "../core/http.js";
import { createHttpClient } from "../core/http.js";

export interface CrawlerConfig {
  /** Optional HTTP client */
  httpClient?: HttpClient;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export interface CrawlerEndpoint {
  method: string;
  path: string;
  description?: string;
}

export interface CrawlerInterface {
  name?: string;
  description?: string;
  endpoints?: CrawlerEndpoint[];
  [key: string]: unknown;
}

/**
 * Crawler for ANP interface definitions
 * 
 * @example
 * ```typescript
 * const crawler = new Crawler();
 * const interface = await crawler.fetch("https://agent.example.com/.well-known/anp-interface.json");
 * 
 * console.log(interface.name);
 * console.log(interface.endpoints);
 * ```
 */
export class Crawler {
  private readonly httpClient: HttpClient;
  private readonly timeout: number;

  constructor(config: CrawlerConfig = {}) {
    this.httpClient = config.httpClient ?? createHttpClient();
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Fetch ANP interface definition
   * 
   * Fail Fast: Throws if fetch fails or status is not 2xx.
   * 
   * @param url - URL to interface definition
   * @returns Parsed interface
   */
  async fetch(url: string): Promise<CrawlerInterface> {
    // Fetch (throws if network fails)
    const response = await this.httpClient.request<CrawlerInterface>(
      url,
      "GET",
      { timeoutMs: this.timeout }
    );

    // Fail Fast: Check HTTP status
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `HTTP ${response.status}: Failed to fetch interface from ${url}`
      );
    }

    // Return data directly
    return response.data;
  }
}

/**
 * Create a crawler instance
 */
export function createCrawler(config?: CrawlerConfig): Crawler {
  return new Crawler(config);
}

/**
 * Fetch interface (shorthand)
 */
export async function fetchInterface(url: string, config?: CrawlerConfig): Promise<CrawlerInterface> {
  const crawler = createCrawler(config);
  return crawler.fetch(url);
}
