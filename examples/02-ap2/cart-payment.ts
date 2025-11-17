/**
 * Example: AP2 Cart and Payment Mandates
 * 
 * Run: bun run examples/02-ap2/cart-payment.ts
 */

import { createCartBuilder, createPaymentBuilder, cartHash } from "../../src/ap2/index.js";
import type { CartContents, PaymentMandateContents } from "../../src/ap2/types/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

async function main() {
  console.log("💳 AP2 Protocol Example\n");

  // Load merchant key
  const keyPath = path.join(process.cwd(), "examples/did_public/public-private-key.pem");
  const merchantKey = await fs.readFile(keyPath, "utf8");

  // 1. Create cart mandate
  console.log("1. Creating cart mandate...");
  const cartBuilder = createCartBuilder({
    privateKeyPem: merchantKey,
    merchantDid: "did:wba:merchant",
    algorithm: "ES256K"
  });

  const cartContents: CartContents = {
    id: `cart-${Date.now()}`,
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
  };

  const cartMandate = await cartBuilder.build(cartContents);
  const hash = cartHash(cartMandate.contents);
  console.log(`   Cart ID: ${cartMandate.contents.id}`);
  console.log(`   Cart Hash: ${hash.slice(0, 20)}...\n`);

  // 2. Create payment mandate
  console.log("2. Creating payment mandate...");
  const paymentBuilder = createPaymentBuilder({
    privateKeyPem: merchantKey,
    userDid: "did:wba:user",
    merchantDid: "did:wba:merchant",
    algorithm: "ES256K"
  });

  const paymentContents: PaymentMandateContents = {
    payment_mandate_id: `payment-${Date.now()}`,
    payment_details_id: "pd-001",
    settlement_total: {
      label: "Settlement",
      amount: { currency: "USDC", value: "149.99" },
      refund_period: 30 * 24 * 60 * 60
    },
    payment_response: {
      request_id: cartMandate.contents.id,
      method_name: "crypto",
      details: { txHash: "0xabc123" }
    },
    timestamp: new Date().toISOString()
  };

  const paymentMandate = await paymentBuilder.build(paymentContents, hash);
  console.log(`   Payment ID: ${paymentMandate.payment_mandate_contents.payment_mandate_id}`);
  console.log(`   Amount: ${paymentMandate.payment_mandate_contents.settlement_total.amount.value}`);

  console.log("\n✨ Done!");
}

main().catch(console.error);
