/**
 * Core Utilities
 * 
 * Platform-independent core utilities.
 * 
 * @packageDocumentation
 */

export * as crypto from "./crypto.js";
export * as did from "./did.js";
export * as jwt from "./jwt.js";
export * as http from "./http.js";
export * as utils from "./utils.js";
export * as hash from "./hash.js";

export { LogManager, ConsoleLogger, NullLogger } from "./logging.js";
export type { Logger, LogLevel } from "./logging.js";

export { createHttpClient } from "./http.js";
export type { HttpClient, FetchLike, FetchHttpClientConfig } from "./http.js";
