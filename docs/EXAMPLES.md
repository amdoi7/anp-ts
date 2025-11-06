# Examples (anp-ts)

本页介绍如何运行与理解 anp-ts 的示例，展示 SDK 自身 API 的用法。

## 目录结构

- examples/identity/basic_header.ts：底层 API 生成 DIDWba 认证头
- examples/identity/verify_with_doc.ts：使用 DID 文档+PKCS#8 私钥完成本地验签
- examples/middleware_server.ts：Express 服务端集成 Verifier 中间件
- examples/transport_client.ts：使用 Authorization 头发起请求
- examples/crawler/fetch_interface.ts：抓取接口文档+调用工具（amap 示例）

## 运行环境

- Bun ≥ 1.0
- 私钥格式：仅支持 PKCS#8（文件头为 `-----BEGIN PRIVATE KEY-----`）
- 植根 Crypto：@noble/curves（secp256k1）/@noble/hashes（sha256）

## 快速开始

安装依赖：

```bash
bun install
```

准备 DID 文档与 PKCS#8 私钥：

```bash
# 将 PKCS#8 私钥保存为 examples/did_public/public-private-key.pem
# 将 DID 文档保存为 examples/did_public/public-did-doc.json
```

### 底层认证（生成 Header）

```bash
bun run ex:basic
```

示例片段：

```ts
import { Authenticator } from "@/anp_auth/authenticator";
import { generateSecp256k1KeyPair } from "@/core/crypto";
import { createDidDocument } from "@/core/did";

const { publicKeyJwk, privateKeyJwk } = await generateSecp256k1KeyPair();
const didDoc = createDidDocument(publicKeyJwk);
const auth = Authenticator.init({ did: didDoc.id, privateKey: privateKeyJwk });
const header = await auth.createAuthorizationHeader(
  "https://api.example.com",
  "GET"
);
console.log(header);
```

### 本地验签（文档+私钥）

```bash
bun run ex:verify:doc
```

示例片段：

```ts
import {
  importSecp256k1PrivateKeyFromPem,
  verifySecp256k1Signature,
} from "@/core/crypto";
import { DidDocumentSchema } from "@/core/did";
import canonicalize from "canonicalize";

// 加载 DID 文档与 PKCS#8 私钥
const did = DidDocumentSchema.parse(
  JSON.parse(await fs.readFile(didPath, "utf8"))
);
const jwk = importSecp256k1PrivateKeyFromPem(
  await fs.readFile(pemPath, "utf8")
);

// 构造 payload 并验签
const payload = { nonce, timestamp, service, did: did.id };
const canonical = (canonicalize as (v: unknown) => string)(payload);
const ok = await verifySecp256k1Signature(
  did.verificationMethod[0].publicKeyJwk as any,
  new TextEncoder().encode(canonical),
  signature
);
```

### 服务端中间件（Express）

```bash
bun run ex:server
# 默认端口 8080，/public 与 /api/profile 可用于验证
```

示例片段：

```ts
import express from "express";
import { anpMiddleware } from "@/anp_auth/middleware/express";
import { Verifier } from "@/anp_auth/verifier";

const app = express();
const verifier = new Verifier({ jwtSecret: "dev-secret" });
app.get("/public", (_req, res) => res.json({ ok: true }));
app.use(anpMiddleware(verifier));
app.get("/api/profile", (req: any, res) => res.json({ did: req.did }));
app.listen(8080);
```

### 客户端请求（带认证）

```bash
bun run ex:client
# 使用 Authorization: DIDWba: ... 发起 GET 请求
```

示例片段：

```ts
import { Authenticator } from "@/anp_auth/authenticator";
import { defaultHttpClient } from "@/core/http";

const header = await auth.createAuthorizationHeader(url, "GET");
const resp = await defaultHttpClient.request(url, "GET", {
  headers: { Authorization: header },
});
```

### Crawler（amap 示例）

```bash
# 必须准备：examples/did_public/public-did-doc.json 与 public-private-key.pem（PKCS#8）
# 环境变量可选覆盖：DOC_URL、INTERFACE_URL、JSONRPC_ENDPOINT、CITY1、CITY2
bun run ex:crawler
```

示例片段：

```ts
import { createCrawler } from "@/anp_crawler/anp_client";

const crawler = createCrawler();
const spec = await crawler.fetchInterface(process.env.INTERFACE_URL!);
spec.endpoints.forEach((e) => console.log(e.method, e.path));
```

## 代码要点

- 认证与验签：统一使用 noble + JCS；签名为 64 字节紧凑格式；验签对等
- 私钥解析：仅接受 PKCS#8；从私钥推导未压缩公钥导出 x/y
- 解析与校验：HTTP 反序列化由 fetchInterface 完成；parseAnpInterface 只做 Zod 校验
- 兼容性：接口文档顶层宽松（允许 @context 等），关键字段严格校验（id/endpoints）

## 参考

- 认证与验签：noble + JCS
- 私钥解析：仅 PKCS#8（BEGIN PRIVATE KEY）
- HTTP：axios 封装（默认客户端与可配置工厂）
- Schema：Zod 校验（顶层宽松、字段严格）
