# AP2 Protocol Examples

This directory contains complete examples demonstrating the AP2 (Agent Payment Protocol) implementation.

## Overview

AP2 is a protocol for secure, DID-based payment authorization between merchants and users. It uses JWT-signed mandates to ensure integrity and authenticity.

## Examples

### 1. Cart Mandate Flow (`cart_mandate_flow.ts`)

Demonstrates the basic cart mandate lifecycle:

- **Merchant creates cart mandate**: Signs cart contents with their private key
- **User verifies cart mandate**: Validates merchant's signature and cart integrity
- **Data validation**: Shows how to use Ajv validators for schema compliance
- **Hash verification**: Demonstrates cart hash computation and verification

**Run:**

```bash
bun run examples/ap2/cart_mandate_flow.ts
```

**Key Concepts:**

- `CartMandateBuilder`: Creates signed cart authorizations
- `cartHash()`: Computes canonical hash of cart contents
- `verifyCartMandate()`: Validates merchant signatures
- Error handling with specific error types

### 2. Payment Mandate Flow (`payment_mandate_flow.ts`)

Demonstrates the complete payment flow:

- **Merchant creates cart mandate**: Initial cart authorization
- **User creates payment mandate**: User signs payment authorization
- **Merchant verifies payment**: Validates user's payment commitment
- **Full validation**: Both cart and payment mandate verification

**Run:**

```bash
bun run examples/ap2/payment_mandate_flow.ts
```

**Key Concepts:**

- `PaymentMandateBuilder`: Creates signed payment authorizations
- Audience targeting (restricting JWT to specific DIDs)
- TTL configuration for different mandate types
- Cart hash linking between cart and payment mandates

## Prerequisites

Before running the examples, ensure you have:

1. **Generated DID keys**: The examples use keys from `examples/did_public/`

   ```bash
   bun run examples/did_public/generate.ts
   ```

2. **Required files**:
   - `examples/did_public/public-did-doc.json`
   - `examples/did_public/public-private-key.pem`
   - `examples/did_public/public-public-key.pem`

## Core Concepts

### Cart Mandate

A **Cart Mandate** is a merchant-signed authorization containing:

- Cart ID and contents
- Payment details (items, totals, payment methods)
- User signature requirement flag
- JWT signature from merchant

```typescript
const cartBuilder = ap2.builders.createCartMandateBuilder({
  merchantPrivateKeyPem: merchantKey,
  merchantDid: "did:wba:example:merchant",
  algorithm: "RS256", // RS256 (default) or ES256K
  ttlSeconds: 15 * 60, // 15 minutes
});

const cartMandate = await cartBuilder.build(cartContents);
```

### Payment Mandate

A **Payment Mandate** is a user-signed payment authorization containing:

- Payment mandate ID
- Reference to cart (via cart hash)
- Settlement details (amount, refund period)
- Payment response (transaction details)
- JWT signature from user

```typescript
const paymentBuilder = ap2.builders.createPaymentMandateBuilder({
  userPrivateKeyPem: userKey,
  userDid: "did:wba:example:user",
  merchantDid: "did:wba:example:merchant",
  algorithm: "RS256", // Must match cart mandate algorithm (RS256 or ES256K)
});

const paymentMandate = await paymentBuilder.build(
  paymentContents,
  cartHash // Links to cart mandate
);
```

### Cart Hash

The cart hash ensures integrity between cart and payment mandates:

```typescript
const hash = ap2.utils.cartHash(cartContents);
// Used in both cart and payment mandates to link them
```

## Configuration

### Default Values

```typescript
import { ap2 } from "anp-ts";

console.log(ap2.constants.AP2_DEFAULTS.CART_TTL_SECONDS); // 900 (15 min)
console.log(ap2.constants.AP2_DEFAULTS.PAYMENT_TTL_SECONDS); // 15552000 (180 days)
console.log(ap2.constants.AP2_DEFAULTS.DEFAULT_ALGORITHM); // "RS256"
```

### Custom Configuration

Override defaults when creating builders:

```typescript
const builder = ap2.builders.createCartMandateBuilder({
  merchantPrivateKeyPem: key,
  merchantDid: did,
  algorithm: "ES256K", // RS256 (default) or ES256K (secp256k1)
  ttlSeconds: 30 * 60, // 30 minutes instead of 15
  logger: customLogger, // Optional logging
});
```

### Supported Algorithms

The TypeScript implementation matches Python's PyJWT library support:

- **RS256** - RSA with SHA-256 (default, widely supported)
- **ES256K** - ECDSA using secp256k1 curve and SHA-256 (for blockchain/crypto apps)

**Implementation Details:**

- **RS256**: Uses the `jose` library for standard RSA signing
- **ES256K**: Uses `@noble/curves` for secp256k1 signing (matches Python PyJWT)

**Note:** The secp256k1 curve (ES256K) is the same curve used in Bitcoin and Ethereum, making it ideal for blockchain-related applications.

## Error Handling

AP2 provides specific error types for different scenarios:

```typescript
import { ap2 } from "anp-ts";

try {
  const mandate = await builder.build(contents);
} catch (error) {
  if (error instanceof ap2.errors.MandateBuildError) {
    console.error("Failed to build mandate:", error.message);
  } else if (error instanceof ap2.errors.SchemaValidationError) {
    console.error("Invalid data schema:", error.message);
  } else if (error instanceof ap2.errors.JwtSigningError) {
    console.error("JWT signing failed:", error.message);
  } else if (error instanceof ap2.errors.InvalidKeyError) {
    console.error("Invalid key:", error.message);
  }
}
```

### Available Error Types

- `AP2Error` - Base error class
- `MandateBuildError` - Mandate creation failed
- `MandateVerificationError` - Verification failed
- `CartHashMismatchError` - Cart hash doesn't match
- `JwtSigningError` - JWT signing failed
- `JwtVerificationError` - JWT verification failed
- `InvalidKeyError` - Invalid public/private key
- `SchemaValidationError` - Data validation failed
- `AP2NetworkError` - HTTP request failed

## Validation

### Runtime Validation (Ajv)

```typescript
const result = ap2.validation.validateCartMandate(cartMandate);
if (result.valid) {
  console.log("Valid!");
} else {
  console.error("Errors:", result.errors);
}
```

### Compile-time Validation (Zod)

All data models use Zod schemas for TypeScript type safety:

```typescript
import { ap2 } from "anp-ts";

// Automatically validated at runtime
const contents: ap2.models.CartContents = {
  id: "cart-001",
  user_signature_required: false,
  payment_request: {
    /* ... */
  },
};
```

## API Reference

### Builders

- `ap2.builders.createCartMandateBuilder(options)`
- `ap2.builders.createPaymentMandateBuilder(options)`

### Verifiers

- `ap2.verifiers.verifyCartMandate(mandate, options)`
- `ap2.verifiers.verifyPaymentMandate(mandate, options)`

### Validators

- `ap2.validation.validateCartMandate(data)`
- `ap2.validation.validateCartContents(data)`
- `ap2.validation.validatePaymentMandate(data)`
- `ap2.validation.validatePaymentMandateContents(data)`

### Utils

- `ap2.utils.cartHash(contents)` - Compute cart hash
- `ap2.utils.jcs(data)` - JSON Canonical Serialization
- `ap2.utils.sha256B64Url(data)` - SHA-256 with base64url encoding

## Production Considerations

1. **Key Management**: Never hardcode private keys. Use secure key management solutions.

2. **TTL Configuration**:

   - Cart mandates: Short TTL (15 minutes) for security
   - Payment mandates: Longer TTL (180 days) for record keeping

3. **Logging**: Enable structured logging in production:

   ```typescript
   const logger = new LogManager(new ConsoleLogger(), "info");
   // Pass logger to all builders and clients
   ```

4. **Error Handling**: Always catch and handle specific error types.

5. **Validation**: Always validate mandates from untrusted sources:
   ```typescript
   // Validate schema
   const schemaValid = ap2.validation.validateCartMandate(mandate);
   // Verify signature
   const verified = await ap2.verifiers.verifyCartMandate(mandate, options);
   ```

## Further Reading

- [AP2 Protocol Specification](../../docs/ap2/)
- [Main Documentation](../../docs/README.md)
- [DID Authentication](../did_public/)

## Troubleshooting

### "Public key PEM not available"

Generate keys first:

```bash
bun run examples/did_public/generate.ts
```

### "Cart hash mismatch"

Ensure you're using the same cart contents for both cart and payment mandates:

```typescript
const cartHash = ap2.utils.cartHash(cartMandate.contents);
const paymentMandate = await paymentBuilder.build(paymentContents, cartHash);
```

### "JWT verification failed"

Check:

- Algorithm matches between signing and verification
- Public key corresponds to private key used for signing
- JWT hasn't expired (check TTL)
- Audience matches if specified
