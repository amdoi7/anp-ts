# ANP_AP2 Protocol Implementation - v1.0a

TypeScript implementation of the ANP_AP2 payment workflow with modular builders and schemas.

## 📁 Module Overview

```
anp-ts/src/ap2/
├── types/                          # Type definitions
│   ├── index.ts                    # Unified exports
│   ├── common.ts                   # Shared types (MoneyAmount, DisplayItem, etc.)
│   ├── cart.ts                     # CartMandate types
│   ├── payment.ts                  # PaymentMandate types
│   └── webhook.ts                  # Webhook credential types
│
├── builders.ts                     # Mandate builders (CartBuilder, PaymentBuilder, WebhookCredentialBuilder)
├── utils.ts                        # Hash utilities (cartHash, paymentMandateHash, contentHash)
├── constants.ts                    # Protocol constants
├── errors.ts                       # Error classes
├── index.ts                        # Main entry point
└── README.md                       # This file
```

## 🚀 Usage

### 1. CartMandate Flow

```typescript
import { createCartBuilder, cartHash, type CartContents } from "anp-ts/ap2";

const cartBuilder = createCartBuilder({
  privateKeyPem: merchantKey,
  merchantDid: "did:wba:merchant",
  shopperDid: "did:wba:shopper",
  algorithm: "ES256K"
});

const cartContents: CartContents = {
  id: "cart-001",
  user_signature_required: true,
  payment_request: {
    method_data: [...],
    details: {...},
    options: {...},
  },
};

const cartMandate = await cartBuilder.build(cartContents);
const hash = cartHash(cartMandate.contents);

// Save hash for later verification
console.log("cart_hash:", hash);
```

**Cart Mandate JWS Payload**:
```json
{
  "iss": "did:wba:merchant",
  "aud": "did:wba:shopper",
  "iat": 1700000000,
  "exp": 1700003600,
  "jti": "uuid-...",
  "cart_hash": "X4fPQ9mK..."
}
```

### 2. PaymentMandate Flow

```typescript
import { 
  createPaymentBuilder, 
  paymentMandateHash, 
  type PaymentMandateContents 
} from "anp-ts/ap2";

const paymentBuilder = createPaymentBuilder({
  privateKeyPem: userKey,
  userDid: "did:wba:user",
  merchantDid: "did:wba:merchant",
  algorithm: "ES256K"
});

const pmtContents: PaymentMandateContents = {
  payment_mandate_id: "pmt-001",
  payment_details_id: "cart-001", // Must match CartMandate
  payment_details_total: {...},
  payment_response: {...},
  merchant_agent: "agent-001",
  timestamp: new Date().toISOString(),
};

const paymentMandate = await paymentBuilder.build(pmtContents, savedCartHash);
const pmtHash = paymentMandateHash(paymentMandate.payment_mandate_contents);

// Save hash for webhook verification
console.log("pmt_hash:", pmtHash);
```

**Payment Mandate JWS Payload**:
```json
{
  "iss": "did:wba:user",
  "aud": "did:wba:merchant",
  "iat": 1700000000,
  "exp": 1700000300,
  "jti": "uuid-...",
  "transaction_data": [
    "X4fPQ9mK...",  // cart_hash
    "Y7gQR2nL..."   // pmt_hash
  ]
}
```

### 3. Webhook Credentials

```typescript
import { 
  createWebhookCredentialBuilder, 
  contentHash,
  type PaymentReceiptContents,
  type FulfillmentReceiptContents 
} from "anp-ts/ap2";

const webhookBuilder = createWebhookCredentialBuilder({
  privateKeyPem: merchantKey,
  merchantDid: "did:wba:merchant",
  shopperDid: "did:wba:shopper",
  algorithm: "ES256K"
});

// Payment Receipt
const paymentReceipt = await webhookBuilder.buildPaymentReceipt(
  {
    payment_mandate_id: "pmt-001",
    provider: "ALIPAY",
    status: "SUCCEEDED",
    transaction_id: "2024111700001",
    out_trade_no: "order-001",
    paid_at: new Date().toISOString(),
    amount: { currency: "CNY", value: 100.00 },
  },
  savedCartHash,
  savedPmtHash
);

// Fulfillment Receipt
const fulfillmentReceipt = await webhookBuilder.buildFulfillmentReceipt(
  {
    order_id: "order-001",
    items: [{ id: "item-1", quantity: 2 }],
    fulfilled_at: new Date().toISOString(),
    shipping: {
      carrier: "SF Express",
      tracking_number: "SF1234567890",
      delivered_eta: new Date(Date.now() + 86400000).toISOString(),
    },
  },
  savedCartHash,
  savedPmtHash
);
```

**Webhook JWS Payload**:
```json
{
  "iss": "did:wba:merchant",
  "aud": "did:wba:shopper",
  "iat": 1700000000,
  "exp": 1700086400,
  "jti": "cred-payrcpt-uuid...",
  "credential_type": "PaymentReceipt",
  "transaction_data": [
    "X4fPQ9mK...",  // cart_hash
    "Y7gQR2nL...",  // pmt_hash
    "Z8hRS3oM..."   // cred_hash
  ]
}
```

## 📝 Type System

### Modular Organization

Types are organized by protocol flow for better maintainability:

```typescript
// Import from specific modules
import type { CartContents } from "anp-ts/ap2/types/cart";
import type { PaymentMandateContents } from "anp-ts/ap2/types/payment";
import type { PaymentReceipt } from "anp-ts/ap2/types/webhook";

// Or import from unified index
import type { 
  CartContents, 
  PaymentMandateContents, 
  PaymentReceipt 
} from "anp-ts/ap2";
```

### Hash Chain Verification

```typescript
import { cartHash, paymentMandateHash, contentHash } from "anp-ts/ap2";
import { verifyJwt } from "anp-ts/core/jwt";

// Verify CartMandate
const cartJws = verifyJwt(cartMandate.merchant_authorization, publicKey);
const computedHash = cartHash(cartMandate.contents);
assert(cartJws.cart_hash === computedHash);

// Verify PaymentMandate
const pmtJws = verifyJwt(paymentMandate.user_authorization, publicKey);
assert(pmtJws.transaction_data[0] === savedCartHash);
assert(pmtJws.transaction_data[1] === paymentMandateHash(paymentMandate.payment_mandate_contents));

// Verify Webhook Credential
const credJws = verifyJwt(paymentReceipt.merchant_authorization, publicKey);
assert(credJws.transaction_data[0] === savedCartHash);
assert(credJws.transaction_data[1] === savedPmtHash);
assert(credJws.transaction_data[2] === contentHash(paymentReceipt.contents));
```

## 🔧 Constants

```typescript
import { ANP_AP2_DEFAULTS, ANP_AP2_VERSION } from "anp-ts/ap2";

console.log(ANP_AP2_VERSION); // "1.0a"
console.log(ANP_AP2_DEFAULTS.CART_TTL_SECONDS); // 3600 (1 hour)
console.log(ANP_AP2_DEFAULTS.PAYMENT_TTL_SECONDS); // 300 (5 minutes)
console.log(ANP_AP2_DEFAULTS.CREDENTIAL_TTL_SECONDS); // 86400 (24 hours)
console.log(ANP_AP2_DEFAULTS.DEFAULT_ALGORITHM); // "RS256"
```

## 🚨 Error Handling

```typescript
import { 
  AP2Error, 
  MandateBuildError, 
  CartHashMismatchError 
} from "anp-ts/ap2";

try {
  const mandate = await cartBuilder.build(cartContents);
} catch (error) {
  if (error instanceof MandateBuildError) {
    console.error("Failed to build mandate:", error.message);
  } else if (error instanceof AP2Error) {
    console.error("AP2 protocol error:", error.message);
  }
}
```

## 📚 Related Documentation

- **Protocol Specification**: `travel-anp-agent/.adrs/0003-protocol-dataflow.md`
- **Final Design**: `travel-anp-agent/.adrs/0003-final-spec.md`
- **Quick Summary**: `travel-anp-agent/.adrs/0003-final-summary.md`
- **Zod Schemas**: `travel-anp-agent/.adrs/zod-schema-updates.ts`
