/**
 * Example: Basic DID-WBA Authentication
 * 
 * Run: bun run examples/01-auth/basic.ts
 */

import { createAuthenticator, createVerifier } from "../../src/index.js";
import { generateSecp256k1KeyPair, createDidFromPublicJwk, createDidDocument } from "../../src/core/crypto.js";

async function main() {
  console.log("🔐 DID-WBA Authentication Example\n");

  // Generate key pair
  console.log("1. Generating key pair...");
  const keyPair = await generateSecp256k1KeyPair();
  const did = createDidFromPublicJwk(keyPair.publicKeyJwk);
  console.log(`   DID: ${did}\n`);

  // Create authenticator
  console.log("2. Creating authenticator...");
  const auth = createAuthenticator({
    did,
    privateKey: keyPair.privateKeyJwk
  });

  // Sign request
  console.log("3. Signing HTTP request...");
  const requestBody = {
    action: "create_order",
    amount: 100.00
  };

  const authHeader = await auth.createAuthHeader("POST", "/api/orders", requestBody);
  console.log(`   Auth Header: ${authHeader.slice(0, 80)}...\n`);

  // Verify signature
  console.log("4. Verifying signature...");
  const verifier = createVerifier();
  
  const didDoc = createDidDocument(keyPair.publicKeyJwk);
  const result = await verifier.verify(authHeader, {
    method: "POST",
    url: "/api/orders",
    body: requestBody,
    didDocument: didDoc
  });

  if (result.verified) {
    console.log(`   ✅ Signature verified!`);
    console.log(`   Signer DID: ${result.did}`);
    console.log(`   Timestamp: ${result.timestamp}`);
  } else {
    console.log(`   ❌ Verification failed: ${result.error}`);
  }

  console.log("\n✨ Done!");
}

main().catch(console.error);
