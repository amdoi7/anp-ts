/**
 * ANP_AP2 Mandate Builders - v1.0a (Final)
 *
 * Provides builders for cart mandates, payment mandates, and webhook credentials using a
 * unified hash chain strategy with dependency-injected signers and configurable TTLs.
 *
 * @packageDocumentation
 */

import type { JWTPayload } from "jose";
import { z } from "zod";
import type {
  CartContents,
  CartMandate,
  PaymentMandateContents,
  PaymentMandate,
  PaymentReceipt,
  FulfillmentReceipt,
  PaymentReceiptContents,
  FulfillmentReceiptContents,
} from "./types/index.js";
import {
  CartContentsSchema,
  PaymentMandateContentsSchema,
  PaymentReceiptContentsSchema,
  FulfillmentReceiptContentsSchema,
} from "./types/index.js";
import { cartHash, paymentMandateHash, contentHash } from "./utils.js";
import { signJwtWithAlgorithm } from "../core/jwt.js";
import { LogManager, createLogger } from "../core/logging.js";
import { ANP_AP2_DEFAULTS, type SupportedJwsAlg } from "./constants.js";

// ============================================
// Simple Interfaces (Dependency Injection)
// ============================================

/**
 * Signer interface for JWT signing
 */
export interface Signer {
  sign(payload: JWTPayload, options: { issuer: string; audience?: string; ttl: number }): Promise<string>;
  getAlgorithm(): string;
}

// ============================================
// Simple Signer Implementation
// ============================================

class JwtSigner implements Signer {
  constructor(
    private readonly privateKeyPem: string,
    private readonly algorithm: SupportedJwsAlg,
    private readonly logger: LogManager
  ) { }

  async sign(payload: JWTPayload, options: { issuer: string; audience?: string; ttl: number }): Promise<string> {
    this.logger.debug("Signing JWT", { algorithm: this.algorithm, issuer: options.issuer });

    return await signJwtWithAlgorithm(
      this.privateKeyPem,
      this.algorithm,
      payload,
      {
        issuer: options.issuer,
        audience: options.audience,
        expiresIn: options.ttl,
      }
    );
  }

  getAlgorithm(): string {
    return this.algorithm;
  }
}

// ============================================
// Cart Mandate Builder
// ============================================

export interface CartBuilderConfig {
  privateKeyPem: string;
  merchantDid: string;
  shopperDid?: string;
  algorithm?: SupportedJwsAlg;
  ttlSeconds?: number;
  logger?: LogManager;
}

/**
 * Cart Mandate Builder
 *
 * Creates CartMandate with JWS payload containing only cart_hash.
 *
 * @example
 * ```typescript
 * const builder = createCartBuilder({
 *   privateKeyPem: merchantKey,
 *   merchantDid: "did:wba:merchant",
 *   shopperDid: "did:wba:shopper",
 *   algorithm: "ES256K"
 * });
 *
 * const mandate = await builder.build(cartContents);
 * ```
 */
export class CartBuilder {
  private readonly signer: Signer;
  private readonly config: Required<Omit<CartBuilderConfig, 'privateKeyPem' | 'logger'>> & { logger: LogManager };

  constructor(config: CartBuilderConfig) {
    const algorithm = config.algorithm ?? ANP_AP2_DEFAULTS.DEFAULT_ALGORITHM;
    const ttlSeconds = config.ttlSeconds ?? ANP_AP2_DEFAULTS.CART_TTL_SECONDS;
    const shopperDid = config.shopperDid ?? "";
    const logger = (config.logger ?? createLogger({ context: { component: "CartBuilder" } })).withContext({ builder: "cart" });

    this.signer = new JwtSigner(config.privateKeyPem, algorithm, logger);
    this.config = {
      merchantDid: config.merchantDid,
      shopperDid,
      algorithm,
      ttlSeconds,
      logger,
    };
  }

  /**
   * Build a signed cart mandate
   *
   * JWS Payload:
   * {
   *   iss, aud, iat, exp, jti,
   *   cart_hash: "b64url(sha256(JCS(contents)))"
   * }
   *
   * ✅ NO extensions field
   */
  async build(contents: CartContents): Promise<CartMandate> {
    this.config.logger.debug("Building cart mandate", { cartId: contents.id });

    // Validate (Zod throws if invalid)
    const validated = CartContentsSchema.parse(contents);

    // Compute hash
    const hash = cartHash(validated);

    // Create JWT payload (only cart_hash, no extensions)
    const payload: JWTPayload = {
      cart_hash: hash,
    };

    // Sign
    const jwt = await this.signer.sign(payload, {
      issuer: this.config.merchantDid,
      audience: this.config.shopperDid || undefined,
      ttl: this.config.ttlSeconds,
    });

    this.config.logger.info("Cart mandate built", { cartId: contents.id, cart_hash: hash });

    return {
      contents: validated,
      merchant_authorization: jwt,
      timestamp: new Date().toISOString(),
    };
  }

  getAlgorithm(): string {
    return this.signer.getAlgorithm();
  }
}

// ============================================
// Payment Mandate Builder
// ============================================

export interface PaymentBuilderConfig {
  privateKeyPem: string;
  userDid: string;
  merchantDid: string;
  algorithm?: SupportedJwsAlg;
  ttlSeconds?: number;
  logger?: LogManager;
}

/**
 * Payment Mandate Builder
 *
 * Creates PaymentMandate with transaction_data array for hash chain.
 *
 * @example
 * ```typescript
 * const builder = createPaymentBuilder({
 *   privateKeyPem: userKey,
 *   userDid: "did:wba:user",
 *   merchantDid: "did:wba:merchant",
 *   algorithm: "ES256K"
 * });
 *
 * const mandate = await builder.build(paymentContents, savedCartHash);
 * ```
 */
export class PaymentBuilder {
  private readonly signer: Signer;
  private readonly config: Required<Omit<PaymentBuilderConfig, 'privateKeyPem' | 'logger'>> & { logger: LogManager };

  constructor(config: PaymentBuilderConfig) {
    const algorithm = config.algorithm ?? ANP_AP2_DEFAULTS.DEFAULT_ALGORITHM;
    const ttlSeconds = config.ttlSeconds ?? ANP_AP2_DEFAULTS.PAYMENT_TTL_SECONDS;
    const logger = (config.logger ?? createLogger({ context: { component: "PaymentBuilder" } })).withContext({ builder: "payment" });

    this.signer = new JwtSigner(config.privateKeyPem, algorithm, logger);
    this.config = {
      userDid: config.userDid,
      merchantDid: config.merchantDid,
      algorithm,
      ttlSeconds,
      logger,
    };
  }

  /**
   * Build a signed payment mandate
   *
   * JWS Payload:
   * {
   *   iss, aud, iat, exp, jti,
   *   transaction_data: [cart_hash, pmt_hash]
   * }
   *
   */
  async build(contents: PaymentMandateContents, cartHash: string): Promise<PaymentMandate> {
    this.config.logger.debug("Building payment mandate", {
      paymentId: contents.payment_mandate_id,
      cartHash,
    });

    // Validate
    const validated = PaymentMandateContentsSchema.parse(contents);

    // Compute pmt_hash
    const pmtHash = paymentMandateHash(validated);

    // Create JWT payload using transaction_data array
    const payload: JWTPayload = {
      transaction_data: [cartHash, pmtHash],
    };

    // Sign
    const jwt = await this.signer.sign(payload, {
      issuer: this.config.userDid,
      audience: this.config.merchantDid,
      ttl: this.config.ttlSeconds,
    });

    this.config.logger.info("Payment mandate built", {
      paymentId: contents.payment_mandate_id,
      transaction_data: [cartHash, pmtHash],
    });

    return {
      payment_mandate_contents: validated,
      user_authorization: jwt,
    };
  }

  getAlgorithm(): string {
    return this.signer.getAlgorithm();
  }
}

// ============================================
// Webhook Credential Builder
// ============================================

export interface WebhookCredentialBuilderConfig {
  privateKeyPem: string;
  merchantDid: string;
  shopperDid: string;
  algorithm?: SupportedJwsAlg;
  ttlSeconds?: number;
  logger?: LogManager;
}

/**
 * Webhook Credential Builder
 *
 * Creates PaymentReceipt or FulfillmentReceipt with complete hash chain.
 *
 * @example
 * ```typescript
 * const builder = createWebhookCredentialBuilder({
 *   privateKeyPem: merchantKey,
 *   merchantDid: "did:wba:merchant",
 *   shopperDid: "did:wba:shopper",
 *   algorithm: "ES256K"
 * });
 *
 * const receipt = await builder.buildPaymentReceipt(
 *   receiptContents,
 *   savedCartHash,
 *   savedPmtHash
 * );
 * ```
 */
export class WebhookCredentialBuilder {
  private readonly signer: Signer;
  private readonly config: Required<Omit<WebhookCredentialBuilderConfig, 'privateKeyPem' | 'logger'>> & { logger: LogManager };

  constructor(config: WebhookCredentialBuilderConfig) {
    const algorithm = config.algorithm ?? ANP_AP2_DEFAULTS.DEFAULT_ALGORITHM;
    const ttlSeconds = config.ttlSeconds ?? ANP_AP2_DEFAULTS.CREDENTIAL_TTL_SECONDS;
    const logger = (config.logger ?? createLogger({ context: { component: "WebhookCredentialBuilder" } })).withContext({ builder: "webhook" });

    this.signer = new JwtSigner(config.privateKeyPem, algorithm, logger);
    this.config = {
      merchantDid: config.merchantDid,
      shopperDid: config.shopperDid,
      algorithm,
      ttlSeconds,
      logger,
    };
  }

  /**
   * Build PaymentReceipt credential
   *
   * JWS Payload:
   * {
   *   iss, aud, iat, exp, jti,
   *   credential_type: "PaymentReceipt",
   *   transaction_data: [cart_hash, pmt_hash, cred_hash]
   * }
   *
   * ✅ Complete hash chain (3 hashes)
   * ✅ NO extensions field
   * ✅ NO whu_hash field
   */
  async buildPaymentReceipt(
    contents: PaymentReceiptContents,
    cartHash: string,
    pmtHash: string
  ): Promise<PaymentReceipt> {
    this.config.logger.debug("Building payment receipt", {
      paymentId: contents.payment_mandate_id,
    });

    // Validate
    const validated = PaymentReceiptContentsSchema.parse(contents);

    // Compute cred_hash
    const credHash = contentHash(validated);

    // Generate credential ID
    const credentialId = `cred-payrcpt-${this.generateUuid()}`;

    // Create JWT payload with transaction_data array containing 3 hashes
    const payload: JWTPayload = {
      jti: credentialId,
      credential_type: "PaymentReceipt",
      transaction_data: [cartHash, pmtHash, credHash],
    };

    // Sign
    const jwt = await this.signer.sign(payload, {
      issuer: this.config.merchantDid,
      audience: this.config.shopperDid,
      ttl: this.config.ttlSeconds,
    });

    this.config.logger.info("Payment receipt built", {
      credentialId,
      transaction_data: [cartHash, pmtHash, credHash],
    });

    return {
      credential_type: "PaymentReceipt",
      version: 1,
      id: credentialId,
      timestamp: new Date().toISOString(),
      contents: validated,
      merchant_authorization: jwt,
    };
  }

  /**
   * Build FulfillmentReceipt credential
   *
   * JWS Payload:
   * {
   *   iss, aud, iat, exp, jti,
   *   credential_type: "FulfillmentReceipt",
   *   transaction_data: [cart_hash, pmt_hash, cred_hash]
   * }
   */
  async buildFulfillmentReceipt(
    contents: FulfillmentReceiptContents,
    cartHash: string,
    pmtHash: string
  ): Promise<FulfillmentReceipt> {
    this.config.logger.debug("Building fulfillment receipt", {
      orderId: contents.order_id,
    });

    // Validate
    const validated = FulfillmentReceiptContentsSchema.parse(contents);

    // Compute cred_hash
    const credHash = contentHash(validated);

    // Generate credential ID
    const credentialId = `cred-fullrcpt-${this.generateUuid()}`;

    // Create JWT payload with transaction_data array containing 3 hashes
    const payload: JWTPayload = {
      jti: credentialId,
      credential_type: "FulfillmentReceipt",
      transaction_data: [cartHash, pmtHash, credHash],
    };

    // Sign
    const jwt = await this.signer.sign(payload, {
      issuer: this.config.merchantDid,
      audience: this.config.shopperDid,
      ttl: this.config.ttlSeconds,
    });

    this.config.logger.info("Fulfillment receipt built", {
      credentialId,
      transaction_data: [cartHash, pmtHash, credHash],
    });

    return {
      credential_type: "FulfillmentReceipt",
      version: 1,
      id: credentialId,
      timestamp: new Date().toISOString(),
      contents: validated,
      merchant_authorization: jwt,
    };
  }

  getAlgorithm(): string {
    return this.signer.getAlgorithm();
  }

  private generateUuid(): string {
    return crypto.randomUUID();
  }
}

// ============================================
// Factory Functions (High-level API)
// ============================================

/**
 * Create a Cart Mandate Builder
 */
export function createCartBuilder(config: CartBuilderConfig): CartBuilder {
  return new CartBuilder(config);
}

/**
 * Create a Payment Mandate Builder
 */
export function createPaymentBuilder(config: PaymentBuilderConfig): PaymentBuilder {
  return new PaymentBuilder(config);
}

/**
 * Create a Webhook Credential Builder
 */
export function createWebhookCredentialBuilder(config: WebhookCredentialBuilderConfig): WebhookCredentialBuilder {
  return new WebhookCredentialBuilder(config);
}
