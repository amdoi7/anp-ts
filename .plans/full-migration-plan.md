# anp-ts Migration Plan

## 1. Introduction

`anp-ts` is a TypeScript-based decentralized identity authentication SDK that implements the **DID-WBA (Decentralized Identifier – Web-Based Authentication)** protocol.

This project aims to provide developers with:
- A set of **lightweight, composable** DID authentication and verification tools;
- Support for both **client-side signing (Authenticator)** and **server-side verification (Verifier)**;
- Based on **Web standard APIs (fetch, crypto.subtle, Blob, FormData)**;
- **Built with Bun, runs natively on Node.js ≥18**;
- No legacy Node module dependencies, zero Polyfills.

---

## 2. Goals

| Goal | Description |
|------|------|
| 🧩 **Composition over Inheritance** | Core modules are implemented with pure functions and composition patterns |
| ⚡ **Extreme Performance** | Built and tested with Bun for extremely fast compilation and startup |
| 🔒 **Security Compliance** | Complies with DID-WBA and OWASP ASVS Level 2 standards |
| 🌐 **Cross-Runtime Compatibility** | Outputs pure ESM modules, runnable in Node ≥18, Edge, and Deno |
| 🧠 **Modern Architecture** | Stateless, no side-effects, pluggable components |
| 🧱 **Engineering Completeness** | Built-in testing, type definitions, CI/CD, and TypeDoc documentation generation |

---

## 3. Core Features

### 3.1 DID & Key Generation
- Generate `secp256k1` key pairs;
- Output DID Document compliant with the `did:wba` specification;
- Support JWK format import/export;
- Support WebCrypto (default) and noble library (fallback);
- Provide utility functions:
  - `toHex`, `fromHex`
  - `toBase58`, `fromBase58`
  - `createDidDocument(publicKey)`

### 3.2 Client-Side Authenticator
- Manage DID and private keys;
- Generate DIDWba Authorization Header:
  ```ts
  const header = await auth.createAuthorizationHeader(url, method);
  ```
- Cache header / token (LRU + TTL);
- Prevent concurrent duplicate signatures (thundering herd protection);
- Support custom timestamps and nonces;
- Output:
  - `Authorization: DIDWba <signature>`;
- Reusable JWT cache;
- Optional browser-side adapter (same API).

### 3.3 Server-Side Verifier
- Verify DIDWba Authorization Header;
- Verify JWT Bearer Token;
- Issue a short-term JWT access token after successful verification;
- Configurable Token / Timestamp validity period;
- Pluggable nonce verification interface (to prevent replay attacks);
- Cache DID Document;
- Provide a concise interface:
  ```ts
  const result = await verifier.verifyDidWbaHeader(req.headers.authorization);
  ```

### 3.4 HTTP Middleware
- Support Express / Fastify / Hono;
- Automatically verify DID / JWT;
- Inject authentication result into `req.did`;
- Built-in error handling and logging hooks;
- Example:
  ```ts
  import { anpMiddleware } from "anp-ts/middleware";
  app.use(anpMiddleware(verifier));
  ```

---

## 4. Toolchain & Dependencies

- **Build Tool**: Bun
- **Language**: TypeScript `^5.9.3`
- **Target Runtimes**: bun
- **Module System**: Pure ESM
- **Testing**: Bun Test Runner
- **Linting**: ESLint / Prettier
- **Crypto**: WebCrypto API (with noble-secp256k1 as a fallback)

---

## 5. Developer-Facing API Design

### 🧭 Core Principles
- Get started with one line of code;
- Automatic token cache management;
- Support for async session communication;
- Automatic type inference;
- Semantically clear API names;
- All interfaces are Promise-based.

---

## 6. API Specification

### 6.1 Project Structure
```
src/
 ├─ core/
 │   ├─ crypto.ts        # WebCrypto interface wrapper
 │   ├─ did.ts           # DID document creation/parsing
 │   ├─ jwt.ts           # JWT signing/verification
 │   ├─ utils.ts         # base64url, cache, etc. utilities
 │   └─ http.ts          # fetch wrapper
 ├─ client/
 │   └─ authenticator.ts # Client-side authenticator
 ├─ server/
 │   └─ verifier.ts      # Server-side verifier
 ├─ middleware/
 │   └─ express.ts       # Node HTTP framework middleware
 └─ index.ts             # Export unified API
```

### 6.2 Key Interfaces
```ts
export interface Authenticator {
  createAuthorizationHeader(url: string, method: string): Promise<string>;
}

export interface Verifier {
  verifyDidWbaHeader(header: string): Promise<{ valid: boolean; did?: string }>;
}
```

### 6.3 Composition Philosophy
- All features are implemented as composable functions;
- No inheritance chains;
- Core logic consists of pure functions;
- Runtime features (cache, nonceStore, fetch) are all injectable dependencies.

### 6.4 Client-Side

#### **Authenticator**
```ts
import { Authenticator } from "anp-ts";

const auth = await Authenticator.init({
  did: "did:wba:example:abc123",
  privateKey: myPrivateKey,
});

const header = await auth.signRequest("https://api.example.com/data", "POST");
await fetch("https://api.example.com/data", { headers: { Authorization: header } });
```
**Description:**
- `Authenticator.init()` automatically generates or imports a DID;
- `signRequest()` will:
  - Automatically generate a nonce;
  - Cache the header;
  - Return a standardized `Authorization` header;
- Extensible with custom nonce/timestamp strategies.

#### **Session (New)**
Used to maintain a persistent communication state with the server.
```ts
import { AnpSession } from "anp-ts";

const session = await AnpSession.connect({
  authenticator: auth,
  endpoint: "https://api.example.com/session",
});

// Establish connection and automatically complete DIDWba authentication
await session.start();

// Bi-directional communication (e.g., WebSocket or long polling)
await session.send({ type: "PING" });
session.on("message", (msg) => console.log("Server says:", msg));
```
**Features:**
- Automatic reconnection;
- Automatic JWT refresh;
- Built-in event system (`on`, `off`, `emit`);
- Unified `fetch` / `WebSocket` communication interface;
- Preserves authentication context (DID, token).

### 6.5 Server-Side

#### **Verifier**
```ts
import { Verifier } from "anp-ts";

const verifier = new Verifier({
  jwtSecret: process.env.JWT_SECRET!,
  nonceStore: new RedisNonceStore(),
});

const result = await verifier.verifyRequest(req);
if (result.valid) {
  console.log("Authenticated DID:", result.did);
}
```
**Description:**
- Automatically identifies Header type (DIDWba / JWT);
- Automatically refreshes or issues a new access token;
- Provides hooks:
  ```ts
  verifier.onIssueToken((token, did) => auditLog(did, token));
  ```

#### **Session Verification**
The server-side `SessionVerifier` is used to verify long-lived connections.
```ts
import { SessionVerifier } from "anp-ts/server";

const sessionVerifier = new SessionVerifier({
  store: new MemorySessionStore(),
  jwtSecret: process.env.JWT_SECRET!,
});

const ws = new WebSocketServer({ port: 8080 });
ws.on("connection", async (conn, req) => {
  const did = await sessionVerifier.verifyHandshake(req);
  if (!did) return conn.close();
  conn.send(JSON.stringify({ welcome: did }));
});
```

### 6.6 Middleware Integration
```ts
import express from "express";
import { createVerifier, anpMiddleware } from "anp-ts";

const verifier = createVerifier({ jwtSecret: "secret" });
const app = express();

app.use(anpMiddleware(verifier));
app.get("/whoami", (req, res) => res.json({ did: req.did }));
```

---

## 7. Session Layer (AnpSession)

### 7.1 Client-Side
- Manages authentication and communication;
- Automatically refreshes tokens;
- Supports WebSocket and HTTP long polling;
- Provides a unified event interface;
- Integrates with `Authenticator`.

### 7.2 Server-Side
- Stores DID and Session state;
- Provides TTL;
- Optional Redis / Memory / Deno KV;
- Provides `SessionVerifier` API.
