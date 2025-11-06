/**
 * Example: Complete Cart Mandate Flow
 *
 * This example demonstrates the full lifecycle of creating and verifying a cart mandate:
 * 1. Merchant creates a cart mandate (signed authorization for cart contents)
 * 2. Shopper receives and verifies the cart mandate
 * 3. Shows how to handle errors and validate data
 *
 * Run with: bun run examples/ap2/cart_mandate_flow.ts
 */

import { ap2, crypto, did, type ap2_models } from "anp-ts";
import type { CartContents } from "@/anp_ap2/models/index.js";
import { LogManager, ConsoleLogger } from "@/core/logging.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

async function main() {
  const logger = new LogManager(new ConsoleLogger(), "info");
  logger.info("Starting Cart Mandate Flow Example");

  // ============================================
  // Setup: Load merchant keys and DID
  // ============================================
  const base = path.resolve(process.cwd(), "examples/did_public");
  const merchantPem = await fs.readFile(path.join(base, "public-private-key.pem"), "utf8");
  const merchantDidDoc = did.DidDocumentSchema.parse(
    JSON.parse(await fs.readFile(path.join(base, "public-did-doc.json"), "utf8")),
  );
  const merchantPrivateKey = crypto.importSecp256k1PrivateKeyFromPem(merchantPem);

  logger.info("Merchant DID loaded", { did: merchantDidDoc.id });

  // ============================================
  // Step 1: Merchant creates a cart mandate
  // ============================================
  logger.info("Step 1: Creating cart mandate");

  const cartBuilder = ap2.builders.createCartMandateBuilder({
    merchantPrivateKeyPem: merchantPem,
    merchantDid: merchantDidDoc.id,
    algorithm: "ES256K", // ES256K for secp256k1 keys
    ttlSeconds: 15 * 60, // 15 minutes
    logger: logger.withContext({ component: "CartMandateBuilder" }),
  });

  const cartContents: CartContents = {
    id: `cart-${Date.now()}`,
    user_signature_required: false,
    payment_request: {
      method_data: [
        {
          supported_methods: "crypto",
          data: {
            networks: ["ethereum", "polygon"],
          },
        },
      ],
      details: {
        id: "payment-details-001",
        total: {
          label: "Total",
          amount: {
            currency: "USD",
            value: "99.99",
          },
        },
        displayItems: [
          {
            label: "Product A",
            quantity: 1,
            amount: {
              currency: "USD",
              value: "79.99",
            },
          },
          {
            label: "Shipping",
            quantity: 1,
            amount: {
              currency: "USD",
              value: "20.00",
            },
          },
        ],
      },
    },
  };

  try {
    const cartMandate = await cartBuilder.build(cartContents);
    logger.info("Cart mandate created successfully", {
      cartId: cartMandate.contents.id,
      jwtLength: cartMandate.merchant_authorization.length,
    });

    // Display cart mandate structure
    console.log("\n📦 Cart Mandate:");
    console.log(JSON.stringify(cartMandate, null, 2));

    // ============================================
    // Step 2: Shopper verifies the cart mandate
    // ============================================
    logger.info("\nStep 2: Verifying cart mandate");

    // Extract public key from merchant's DID document
    const merchantPublicKeyPem = await extractPublicKeyPem(merchantDidDoc);

    const verificationResult = await ap2.verifiers.verifyCartMandate(cartMandate, {
      merchant_public_key_pem: merchantPublicKeyPem,
      algorithm: "ES256K", // Must match signing algorithm
      logger: logger.withContext({ component: "CartMandateVerifier" }),
    });

    logger.info("Cart mandate verified successfully", {
      issuer: verificationResult.iss,
      expiresAt: new Date((verificationResult.exp as number) * 1000).toISOString(),
    });

    console.log("\n✅ Verification Result:");
    console.log(JSON.stringify(verificationResult, null, 2));

    // ============================================
    // Step 3: Validate cart data with Ajv
    // ============================================
    logger.info("\nStep 3: Validating cart structure");

    const validationResult = ap2.validation.validateCartMandate(cartMandate);
    if (validationResult.valid) {
      logger.info("Cart mandate structure is valid");
    } else {
      logger.error("Cart mandate validation failed", new Error("Validation errors"), {
        errors: validationResult.errors,
      });
    }

    // ============================================
    // Step 4: Compute and verify cart hash
    // ============================================
    logger.info("\nStep 4: Computing cart hash");

    const computedHash = ap2.utils.cartHash(cartMandate.contents);
    logger.info("Cart hash computed", { hash: computedHash });

    console.log("\n🔐 Cart Hash:", computedHash);
    console.log("\n✨ Cart mandate flow completed successfully!");
  } catch (error) {
    if (error instanceof ap2.errors.MandateBuildError) {
      logger.error("Failed to build cart mandate", error);
    } else if (error instanceof ap2.errors.MandateVerificationError) {
      logger.error("Failed to verify cart mandate", error);
    } else if (error instanceof ap2.errors.SchemaValidationError) {
      logger.error("Schema validation failed", error);
    } else {
      logger.error("Unexpected error", error as Error);
    }
    process.exit(1);
  }
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
  process.exit(1);
});

