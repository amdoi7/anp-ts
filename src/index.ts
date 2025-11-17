/**
 * ANP-TS - Modern TypeScript SDK for ANP Protocol
 * 
 * Simple, platform-independent, type-safe SDK for:
 * - DID-WBA Authentication
 * - ANP Interface Discovery  
 * - AP2 Payment Protocol
 * - Agent Server & Client (P2P)
 * 
 * ## Design Principles
 * 
 * 1. **Simple** - No over-engineering, clean APIs
 * 2. **Platform-independent** - Works in browser, Node.js, Deno, Bun, React Native
 * 3. **Fail Fast** - Errors thrown immediately, no defensive programming
 * 4. **Type-safe** - Full TypeScript support
 * 5. **Tree-shakeable** - Import only what you need
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { createAuthenticator, createCartBuilder, createCrawler } from "anp-ts";
 * 
 * // Authentication
 * const auth = createAuthenticator({ did, privateKey });
 * const authHeader = await auth.createAuthHeader("POST", "/api", body);
 * 
 * // AP2 Payment
 * const builder = createCartBuilder({ privateKeyPem, merchantDid });
 * const mandate = await builder.build(cartContents);
 * 
 * // Interface Discovery
 * const crawler = createCrawler();
 * const interface = await crawler.fetch(url);
 * 
 * // Agent Server
 * import { createAgent } from "anp-ts/server/hono";
 * const agent = createAgent({ name: "My Agent", did, baseUrl });
 * 
 * // Agent Client
 * import { discoverAgent } from "anp-ts/client";
 * const peer = await discoverAgent("did:wba:example.com");
 * ```
 * 
 * ## Tree-shaking Imports
 * 
 * ```typescript
 * import { createAuthenticator } from "anp-ts/auth";
 * import { createCrawler } from "anp-ts/crawler";
 * import { createCartBuilder, cartHash } from "anp-ts/ap2";
 * import { crypto, did } from "anp-ts/core";
 * import { createAgent } from "anp-ts/server/hono";
 * import { createAgentClient, discoverAgent } from "anp-ts/client";
 * ```
 * 
 * @packageDocumentation
 */

// ============================================
// High-level API (Most Common)
// ============================================

// Client (includes auth and crawler)
export { 
  // Auth
  Authenticator, 
  createAuthenticator,
  Verifier,
  createVerifier,
  // Crawler
  Crawler,
  createCrawler,
  fetchInterface,
  // Agent Client
  createClient,
  discover,
} from "./client/index.js";

export type { 
  // Auth types
  AuthenticatorConfig,
  VerifierConfig,
  VerifyOptions,
  VerificationResult,
  // Crawler types
  CrawlerConfig,
  CrawlerInterface,
  CrawlerEndpoint,
  // Client types
  AgentClient,
  AgentClientConfig,
  AgentDescription,
  OpenRPCDocument,
} from "./client/index.js";

// Server (Agent creation and serving)
export { createAgent, serve } from "./server/index.js";
export type { 
  Agent,
  AgentConfig,
  CapabilityConfig,
  CapabilityHandler,
  ResourceConfig,
  Context,
  Session,
  ServeOptions,
} from "./server/index.js";

// Server Decorators (optional, for decorator-based API)
export { Agent as AgentDecorator, Capability, Resource } from "./server/decorators.js";

// AP2 (most common APIs)
export {
  createCartBuilder,
  createPaymentBuilder,
  cartHash,
} from "./ap2/index.js";

export type {
  CartBuilder,
  PaymentBuilder,
  CartContents,
  CartMandate,
  PaymentMandate,
  PaymentMandateContents,
} from "./ap2/index.js";

// Core utilities (commonly used)
export * as crypto from "./core/crypto.js";
export * as did from "./core/did.js";
export * as utils from "./core/utils.js";

// Types
export type { JsonWebKey } from "crypto";
