# anp-ts

> Modern, platform-independent TypeScript SDK for ANP (Agent Network Protocol)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

**Simple • Platform-independent • Fail Fast • Type-safe • Tree-shakeable**

## Features

- 🔐 **DID-WBA Authentication** - Decentralized identity authentication
- 💳 **AP2 Payment Protocol** - Cart and payment mandate creation  
- 🕷️ **ANP Interface Discovery** - Crawl agent interface definitions
- 🌐 **Platform-independent** - Browser, Node.js, Deno, Bun, React Native, Cloudflare Workers
- ⚡ **Fail Fast** - Errors thrown immediately, no defensive programming
- 📦 **Tree-shakeable** - Import only what you need
- 🎯 **Type-safe** - Full TypeScript support with Zod validation

## Installation

```bash
npm install anp-ts
# or
bun add anp-ts
# or
pnpm add anp-ts
```

## Quick Start

### DID-WBA Authentication

```typescript
import { createAuthenticator, createVerifier } from "anp-ts";
import { generateSecp256k1KeyPair } from "anp-ts/core";

// Generate key pair
const keyPair = await generateSecp256k1KeyPair();

// Create authenticator
const auth = createAuthenticator({
  did: "did:wba:example.com",
  privateKey: keyPair.privateKey
});

// Sign HTTP request
const authHeader = await auth.createAuthHeader("POST", "/api/orders", requestBody);
// Returns: DidWba did="...", sig="...", ts="..."

// Verify signature
const verifier = createVerifier();
const result = await verifier.verify(authHeader, {
  method: "POST",
  url: "/api/orders",
  body: requestBody
});

console.log(result.verified); // true
```

### AP2 Payment Protocol

```typescript
import { createCartBuilder, createPaymentBuilder, cartHash } from "anp-ts/ap2";

// Create cart mandate
const cartBuilder = createCartBuilder({
  privateKeyPem: merchantKey,
  merchantDid: "did:wba:merchant",
  algorithm: "ES256K" // or "RS256"
});

const cartMandate = await cartBuilder.build({
  id: "cart-001",
  user_signature_required: true,
  payment_request: {
    method_data: [{ supported_methods: "crypto" }],
    details: {
      id: "pd-001",
      total: {
        label: "Total",
        amount: { currency: "USDC", value: "149.99" }
      }
    }
  }
});

// Create payment mandate
const hash = cartHash(cartMandate.contents);

const paymentBuilder = createPaymentBuilder({
  privateKeyPem: userKey,
  userDid: "did:wba:user",
  merchantDid: "did:wba:merchant",
  algorithm: "ES256K"
});

const paymentMandate = await paymentBuilder.build(paymentContents, hash);
```

### ANP Interface Discovery

```typescript
import { createCrawler } from "anp-ts/crawler";

const crawler = createCrawler();
const interface = await crawler.fetch("https://agent.example.com/.well-known/anp-interface.json");

console.log(interface.name);
console.log(interface.endpoints);
```

## Tree-shaking Imports

Import from specific modules for better tree-shaking:

```typescript
// Specific imports (recommended for production)
import { createAuthenticator } from "anp-ts/auth";
import { createCartBuilder, cartHash } from "anp-ts/ap2";
import { createCrawler } from "anp-ts/crawler";
import { crypto, did } from "anp-ts/core";

// Or from main entry (convenient for prototyping)
import { createAuthenticator, createCartBuilder, createCrawler } from "anp-ts";
```

## Platform Compatibility

| Platform | Support | Notes |
|----------|---------|-------|
| **Browsers** | ✅ Full | Modern browsers (Chrome, Firefox, Safari, Edge) |
| **Node.js 18+** | ✅ Full | Built-in `fetch` API |
| **Node.js 16-** | ✅ Supported | Requires `node-fetch` polyfill |
| **Deno** | ✅ Full | Built-in `fetch` API |
| **Bun** | ✅ Full | Built-in `fetch` API |
| **React Native** | ✅ Full | Built-in `fetch` API |
| **Cloudflare Workers** | ✅ Full | Built-in `fetch` API |

### Node.js <18 Setup

```typescript
import fetch from 'node-fetch';
import { createHttpClient } from 'anp-ts/core';

// Inject fetch implementation
const httpClient = createHttpClient({ fetchImpl: fetch });

// Use with crawler
const crawler = createCrawler({ httpClient });
```

## Design Principles

1. **Simple** - No over-engineering, clean APIs
2. **Platform-independent** - Pure TypeScript/JavaScript, no platform-specific APIs
3. **Fail Fast** - Errors thrown immediately, no defensive programming
4. **Composition over Inheritance** - Flexible, testable code
5. **Type-safe** - Full TypeScript support
6. **Tree-shakeable** - Modular exports for minimal bundle size

## API Reference

### Auth Module (`anp-ts/auth`)

- `createAuthenticator(config)` - Create DID-WBA authenticator
- `createVerifier(config?)` - Create signature verifier
- `Authenticator` - Authenticator class
- `Verifier` - Verifier class

### AP2 Module (`anp-ts/ap2`)

- `createCartBuilder(config)` - Create cart mandate builder
- `createPaymentBuilder(config)` - Create payment mandate builder
- `cartHash(contents)` - Compute cart hash
- `jcs(data)` - JSON canonical serialization
- `sha256B64Url(data)` - SHA-256 with base64url encoding

### Crawler Module (`anp-ts/crawler`)

- `createCrawler(config?)` - Create ANP interface crawler
- `fetchInterface(url, config?)` - Fetch interface (shorthand)

### Core Module (`anp-ts/core`)

- `crypto` - Cryptographic utilities (secp256k1)
- `did` - DID creation and resolution
- `jwt` - JWT signing and verification
- `http` - HTTP client (platform-independent)
- `utils` - General utilities

## Examples

See the [examples/](./examples/) directory for complete examples:

- `01-auth/basic.ts` - DID-WBA authentication
- `02-ap2/cart-payment.ts` - AP2 cart and payment mandates
- `03-crawler/fetch.ts` - ANP interface discovery

Run examples:

```bash
bun run example:auth
bun run example:ap2
bun run example:crawler
```

## Error Handling

This SDK follows the **Fail Fast** principle - errors are thrown immediately:

```typescript
try {
  const mandate = await builder.build(cartContents);
  await sendToServer(mandate);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Validation failed:", error.issues);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md).

## License

Apache-2.0

---

**Documentation**: [ARCHITECTURE_SIMPLE.md](./ARCHITECTURE_SIMPLE.md) | [PLATFORM_COMPATIBILITY.md](./PLATFORM_COMPATIBILITY.md) | [FAIL_FAST.md](./FAIL_FAST.md)

**Built with**: TypeScript 5.9 • Zod • jose • @noble/curves • @noble/hashes
