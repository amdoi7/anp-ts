# anp-ts SDK Documentation

anp-ts 是 ANP（Agent Network Protocol）在 TypeScript 生态的 SDK 实现，聚焦于 DID-WBA 签名/校验、接口抓取与验证、以及示例工程。

核心特性：

- 仅使用 @noble/curves/@noble/hashes（跨运行时、可移植、无 WebCrypto 依赖）
- 仅支持 PKCS#8 私钥（`-----BEGIN PRIVATE KEY-----`），secp256k1；公钥以未压缩点导出 x/y
- JCS（RFC 8785）规范化签名/验签
- 原生 fetch 作为 HTTP 客户端
- Zod 做结构化校验与友好错误提示
- 支持 zod-to-json-schema + Ajv 生成/复用 JSON Schema

目录：

- Quickstart: docs/quickstart.md
- API: docs/api/authenticator.md, docs/api/verifier.md, docs/api/crawler.md
- 设计约束: noble-only、PKCS#8-only（本页下方）

## 设计约束

- Crypto：完全基于 @noble/curves（secp256k1）与 @noble/hashes/sha256；不依赖 WebCrypto/CryptoKey
- 私钥输入：仅允许 PKCS#8 `BEGIN PRIVATE KEY`；解析后推导公钥，导出 JWK {kty:EC, crv:secp256k1, x, y, d}
- DID 文档：解析遵循 did:wba 到 `https://{domain}/.well-known/did.json`（或 path）
- HTTP：统一通过原生 fetch 封装（默认客户端与可配置工厂）
- Schema：使用 Zod；顶层允许额外字段（如 `@context`），对关键字段严格校验

## 快速示例

使用内置 Crawler 获取接口描述：

```ts
import { crawler } from "anp-ts";

async function main() {
  const endpoint =
    process.env.INTERFACE_URL ??
    "https://agent-connect.ai/mcp/agents/api/amap.json";
  const spec = await crawler.fetchInterface(endpoint);
  console.log(`Interface: ${spec.id}`);
  for (const ep of spec.endpoints) {
    console.log(`${ep.method} ${ep.path}`);
  }
}

main();
```
