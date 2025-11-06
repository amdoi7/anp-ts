import * as models from "./models/index.js";
import * as parsers from "./parsers/index.js";
import { CrawlerClient, createCrawlerClient, fetchCrawlerInterface, type CrawlerClientOptions } from "./services/client.js";
import { AnpCrawlerError } from "./errors.js";
import type { CrawlerInterface } from "./models/interface.js";

export {
  models,
  parsers,
  CrawlerClient,
  createCrawlerClient,
  fetchCrawlerInterface,
  AnpCrawlerError,
  type CrawlerClientOptions,
  type CrawlerInterface,
};

export const crawler = {
  createClient: createCrawlerClient,
  CrawlerClient,
  fetchInterface: fetchCrawlerInterface,
  models,
  parsers,
  AnpCrawlerError,
};


