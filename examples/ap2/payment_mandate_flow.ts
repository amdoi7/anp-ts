/**
 * Example: Complete Payment Mandate Flow
 *
 * This example demonstrates the full payment flow:
 * 1. Merchant creates a cart mandate
 * 2. User receives cart mandate and creates payment mandate
 * 3. Merchant verifies the payment mandate
 * 4. Shows how to use AP2Client for communication
 *
 * Run with: bun run examples/ap2/payment_mandate_flow.ts
 */

import { ap2, crypto, did, Authenticator, type ap2_models } from "anp-ts";
import type { CartContents, PaymentMandateContents } from "@/anp_ap2/models/index.js";
import { LogManager, ConsoleLogger } from "@/core/logging.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

async function main() {
  const logger = new LogManager(new ConsoleLogger(), "info");
  logger.info("Starting Payment Mandate Flow Example");

  // ============================================
  // Setup: Load keys for merchant and user
  // ============================================
  const base = path.resolve(process.cwd(), "examples/did_public");
  const merchantPem = await fs.readFile(path.join(base, "public-private-key.pem"), "utf8");
  const merchantDidDoc = did.DidDocumentSchema.parse(
    JSON.parse(await fs.readFile(path.join(base, "public-did-doc.json"), "utf8")),
  );

  // For this example, we'll use the same keys for both parties
  // In production, user would have their own keys
  const userPem = merchantPem;
  const userDid = merchantDidDoc.id;

  logger.info("Keys loaded", { merchantDid: merchantDidDoc.id, userDid });

  // ============================================
  // Step 1: Create cart mandate (merchant side)
  // ============================================
  logger.info("\nStep 1: Merchant creates cart mandate");

  const cartBuilder = ap2.builders.createCartMandateBuilder({
    merchantPrivateKeyPem: merchantPem,
    merchantDid: merchantDidDoc.id,
    shopperDid: userDid, // Optional: restrict to specific user
    algorithm: "ES256K", // ES256K for secp256k1 keys (matches Python PyJWT)
    logger: logger.withContext({ component: "CartMandateBuilder" }),
  });

  const cartContents: CartContents = {
    id: `cart-${Date.now()}`,
    user_signature_required: true,
    payment_request: {
      method_data: [
        {
          supported_methods: "crypto",
          data: { networks: ["ethereum"] },
        },
      ],
      details: {
        id: "payment-details-002",
        total: {
          label: "Order Total",
          amount: {
            currency: "USDC",
            value: "149.99",
          },
        },
        displayItems: [
          {
            label: "Premium Subscription (1 year)",
            quantity: 1,
            amount: {
              currency: "USDC",
              value: "149.99",
            },
          },
        ],
      },
    },
  };

  const cartMandate = await cartBuilder.build(cartContents);
  const cartHash = ap2.utils.cartHash(cartMandate.contents);

  logger.info("Cart mandate created", {
    cartId: cartMandate.contents.id,
    cartHash,
  });

  console.log("\n📦 Cart Mandate Created:");
  console.log(`  Cart ID: ${cartMandate.contents.id}`);
  console.log(`  Cart Hash: ${cartHash}`);
  console.log(`  User Signature Required: ${cartMandate.contents.user_signature_required}`);

  // ============================================
  // Step 2: User creates payment mandate
  // ============================================
  logger.info("\nStep 2: User creates payment mandate");

  const paymentBuilder = ap2.builders.createPaymentMandateBuilder({
    userPrivateKeyPem: userPem,
    userDid: userDid,
    merchantDid: merchantDidDoc.id,
    algorithm: "ES256K", // ES256K for secp256k1 keys (matches Python PyJWT)
    ttlSeconds: 180 * 24 * 60 * 60, // 180 days
    logger: logger.withContext({ component: "PaymentMandateBuilder" }),
  });

  const paymentMandateContents: PaymentMandateContents = {
    payment_mandate_id: `payment-${Date.now()}`,
    payment_details_id: cartMandate.contents.payment_request.details.id,
    settlement_total: {
      label: "Settlement Total",
      amount: {
        currency: "USDC",
        value: "149.99",
      },
      refund_period: 30 * 24 * 60 * 60, // 30 days refund period
    },
    payment_response: {
      request_id: cartMandate.contents.id,
      method_name: "crypto",
      details: {
        network: "ethereum",
        token: "USDC",
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      },
    },
    timestamp: new Date().toISOString(),
  };

  const paymentMandate = await paymentBuilder.build(paymentMandateContents, cartHash);

  logger.info("Payment mandate created", {
    paymentMandateId: paymentMandate.payment_mandate_contents.payment_mandate_id,
    txHash: paymentMandate.payment_mandate_contents.payment_response.details?.txHash,
  });

  console.log("\n💳 Payment Mandate Created:");
  console.log(`  Payment ID: ${paymentMandate.payment_mandate_contents.payment_mandate_id}`);
  console.log(`  Settlement Total: ${paymentMandate.payment_mandate_contents.settlement_total.amount.value} ${paymentMandate.payment_mandate_contents.settlement_total.amount.currency}`);
  console.log(`  Refund Period: ${paymentMandate.payment_mandate_contents.settlement_total.refund_period} seconds`);

  // ============================================
  // Step 3: Merchant verifies payment mandate
  // ============================================
  logger.info("\nStep 3: Merchant verifies payment mandate");

  const userPublicKeyPem = await extractPublicKeyPem(merchantDidDoc); // Using same keys for demo

  const verificationResult = await ap2.verifiers.verifyPaymentMandate(paymentMandate, {
    user_public_key_pem: userPublicKeyPem,
    algorithm: "ES256K", // Must match signing algorithm
    expected_cart_hash: cartHash,
    expected_aud: merchantDidDoc.id,
    logger: logger.withContext({ component: "PaymentMandateVerifier" }),
  });

  logger.info("Payment mandate verified successfully", {
    issuer: verificationResult.iss,
    audience: verificationResult.aud,
    cartHash: verificationResult.cart_hash,
  });

  console.log("\n✅ Payment Mandate Verified:");
  console.log(`  Issuer (User): ${verificationResult.iss}`);
  console.log(`  Audience (Merchant): ${verificationResult.aud}`);
  console.log(`  Cart Hash Matches: ${verificationResult.cart_hash === cartHash}`);

  // ============================================
  // Step 4: Validate with Ajv schemas
  // ============================================
  logger.info("\nStep 4: Validating structures with Ajv");

  const cartValidation = ap2.validation.validateCartMandate(cartMandate);
  const paymentValidation = ap2.validation.validatePaymentMandate(paymentMandate);

  console.log("\n🔍 Validation Results:");
  console.log(`  Cart Mandate: ${cartValidation.valid ? "✅ Valid" : "❌ Invalid"}`);
  console.log(`  Payment Mandate: ${paymentValidation.valid ? "✅ Valid" : "❌ Invalid"}`);

  if (!cartValidation.valid || !paymentValidation.valid) {
    console.log("\n❌ Validation Errors:");
    if (!cartValidation.valid) {
      console.log("  Cart:", cartValidation.errors);
    }
    if (!paymentValidation.valid) {
      console.log("  Payment:", paymentValidation.errors);
    }
  }

  // ============================================
  // Step 5: Show constants and configuration
  // ============================================
  console.log("\n⚙️  AP2 Configuration:");
  console.log(`  Version: ${ap2.constants.AP2_VERSION}`);
  console.log(`  Default Cart TTL: ${ap2.constants.AP2_DEFAULTS.CART_TTL_SECONDS}s (${ap2.constants.AP2_DEFAULTS.CART_TTL_SECONDS / 60} minutes)`);
  console.log(`  Default Payment TTL: ${ap2.constants.AP2_DEFAULTS.PAYMENT_TTL_SECONDS}s (${ap2.constants.AP2_DEFAULTS.PAYMENT_TTL_SECONDS / 60 / 60 / 24} days)`);
  console.log(`  Default Algorithm: ${ap2.constants.AP2_DEFAULTS.DEFAULT_ALGORITHM}`);

  logger.info("\n✨ Payment mandate flow completed successfully!");
}

/**
 * Helper function to extract public key PEM from DID document or private key
 * For ES256K (secp256k1), the private key PEM contains the public key information
 */
async function extractPublicKeyPem(didDoc: did.DidDocument): Promise<string> {
  // For this example, we'll use the same private key PEM
  // (secp256k1 verification works with private key PEM as it contains public key)
  const base = path.resolve(process.cwd(), "examples/did_public");
  return await fs.readFile(path.join(base, "public-private-key.pem"), "utf8");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  if (error instanceof ap2.errors.AP2Error) {
    console.error("AP2 Error Type:", error.name);
  }
  process.exit(1);
});

