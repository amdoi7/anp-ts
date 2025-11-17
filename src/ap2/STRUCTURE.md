# ANP_AP2 项目结构说明

**版本**: v1.0a  
**日期**: 2025-01-17

---

## 📁 目录结构

```
anp-ts/src/ap2/
├── types/                  # 类型定义目录（核心）
│   ├── index.ts           # 统一导出
│   ├── common.ts          # 共享类型（MoneyAmount, DisplayItem 等）
│   ├── cart.ts            # CartMandate 流程类型
│   ├── payment.ts         # PaymentMandate 流程类型
│   └── webhook.ts         # Webhook 凭证类型
│
├── builders.ts            # Builder 实现（CartBuilder, PaymentBuilder, WebhookCredentialBuilder）
├── utils.ts               # 工具函数（cartHash, paymentMandateHash, contentHash）
├── constants.ts           # 常量定义
├── errors.ts              # 错误类
├── index.ts               # 主入口（导出所有公共 API）
│
├── README.md              # 使用文档
├── CHANGELOG.md           # 版本历史
└── STRUCTURE.md           # 本文件
```

---

## 📊 文件统计

| 文件 | 大小 | 行数 | 用途 |
|------|------|------|------|
| **types/** | | | |
| `types/index.ts` | 2.4K | ~80 | 统一类型导出 |
| `types/common.ts` | 4.7K | ~130 | 共享基础类型 |
| `types/cart.ts` | 2.8K | ~80 | CartMandate 类型 |
| `types/payment.ts` | 3.6K | ~110 | PaymentMandate 类型 |
| `types/webhook.ts` | 4.5K | ~130 | Webhook 凭证类型 |
| **根目录** | | | |
| `builders.ts` | 13K | ~490 | 三个 Builder 类实现 |
| `utils.ts` | 1.8K | ~80 | 哈希工具函数 |
| `constants.ts` | 332B | ~15 | 常量定义 |
| `errors.ts` | 2.2K | ~80 | 错误类定义 |
| `index.ts` | 4.6K | ~190 | 主入口 |
| **总计** | ~40K | ~1,400 | |

---

## 🎯 设计原则

### 1. 模块化设计
- **按协议流程划分**: cart, payment, webhook 独立模块
- **单一职责**: 每个文件只负责一个协议流程
- **清晰的依赖关系**: types → utils → builders → index

### 2. 类型优先
- **所有类型定义集中在 `types/` 目录**
- **Zod Schema 提供运行时验证**
- **TypeScript 类型推导自动完成**

### 3. 简洁的 API
- **三个 Builder 类**: CartBuilder, PaymentBuilder, WebhookCredentialBuilder
- **三个哈希函数**: cartHash(), paymentMandateHash(), contentHash()
- **统一的导出**: 从 `anp-ts/ap2` 导入所有内容

---

## 🔄 依赖关系图

```
index.ts (主入口)
  ├─→ types/index.ts (所有类型)
  │     ├─→ types/common.ts (基础类型)
  │     ├─→ types/cart.ts (依赖 common.ts)
  │     ├─→ types/payment.ts (依赖 common.ts)
  │     └─→ types/webhook.ts (依赖 common.ts)
  │
  ├─→ builders.ts (Builder 实现)
  │     ├─→ types/index.ts (类型导入)
  │     ├─→ utils.ts (哈希函数)
  │     └─→ constants.ts (常量)
  │
  ├─→ utils.ts (哈希工具)
  │     └─→ types/index.ts (类型导入)
  │
  ├─→ constants.ts (常量)
  └─→ errors.ts (错误类)
```

---

## 📝 使用指南

### 导入方式

#### 1. 从主入口导入（推荐）
```typescript
import { 
  createCartBuilder, 
  createPaymentBuilder,
  cartHash,
  type CartContents,
  type PaymentMandateContents 
} from "anp-ts/ap2";
```

#### 2. 从特定模块导入
```typescript
// 只导入类型
import type { CartContents } from "anp-ts/ap2/types/cart";
import type { PaymentReceipt } from "anp-ts/ap2/types/webhook";

// 只导入工具函数
import { cartHash, paymentMandateHash } from "anp-ts/ap2/utils";
```

---

## ✨ 关键特性

### 1. 完整的类型系统
- ✅ 46 个导出类型
- ✅ Zod Schema 运行时验证
- ✅ TypeScript 静态检查

### 2. 简洁的 API
- ✅ 3 个 Builder 类
- ✅ 3 个哈希函数
- ✅ 统一的导出接口

### 3. 符合协议规范
- ✅ 移除 `extensions` 字段
- ✅ 移除 `whu_hash` 字段
- ✅ 统一 `transaction_data` 哈希链
- ✅ `credential_webhook_url` 在顶层

---

## 🚀 快速开始

```typescript
import { 
  createCartBuilder,
  createPaymentBuilder,
  createWebhookCredentialBuilder,
  cartHash,
  paymentMandateHash
} from "anp-ts/ap2";

// 1. Cart Mandate
const cartBuilder = createCartBuilder({
  privateKeyPem: merchantKey,
  merchantDid: "did:wba:merchant",
  shopperDid: "did:wba:shopper",
});
const cartMandate = await cartBuilder.build(cartContents);
const hash = cartHash(cartMandate.contents);

// 2. Payment Mandate
const pmtBuilder = createPaymentBuilder({
  privateKeyPem: userKey,
  userDid: "did:wba:user",
  merchantDid: "did:wba:merchant",
});
const pmtMandate = await pmtBuilder.build(pmtContents, hash);
const pmtHash = paymentMandateHash(pmtMandate.payment_mandate_contents);

// 3. Webhook Credentials
const webhookBuilder = createWebhookCredentialBuilder({
  privateKeyPem: merchantKey,
  merchantDid: "did:wba:merchant",
  shopperDid: "did:wba:shopper",
});
const receipt = await webhookBuilder.buildPaymentReceipt(
  receiptContents,
  hash,
  pmtHash
);
```

---

## 📚 相关文档

- **使用指南**: `README.md`
- **版本历史**: `CHANGELOG.md`
- **协议规范**: `travel-anp-agent/.adrs/0003-protocol-dataflow.md`
- **Zod Schema**: `travel-anp-agent/.adrs/zod-schema-updates.ts`

---

**状态**: ✅ 完成  
**最后更新**: 2025-01-17
