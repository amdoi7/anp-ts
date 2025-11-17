/**
 * ANP_AP2 Protocol Implementation - v1.0a (Final)
 * 
 * Mandate builders, webhook credential helpers, and hash utilities for ANP_AP2 workflows.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { 
 *   createCartBuilder, 
 *   createPaymentBuilder, 
 *   createWebhookCredentialBuilder,
 *   cartHash, 
 *   paymentMandateHash 
 * } from "anp-ts/ap2";
 * 
 * // Create cart mandate
 * const cartBuilder = createCartBuilder({
 *   privateKeyPem: merchantKey,
 *   merchantDid: "did:wba:merchant",
 *   shopperDid: "did:wba:shopper",
 *   algorithm: "ES256K"
 * });
 * 
 * const cartMandate = await cartBuilder.build(cartContents);
 * const hash = cartHash(cartMandate.contents);
 * 
 * // Create payment mandate
 * const paymentBuilder = createPaymentBuilder({
 *   privateKeyPem: userKey,
 *   userDid: "did:wba:user",
 *   merchantDid: "did:wba:merchant",
 *   algorithm: "ES256K"
 * });
 * 
 * const paymentMandate = await paymentBuilder.build(paymentContents, hash);
 * const pmtHash = paymentMandateHash(paymentMandate.payment_mandate_contents);
 * 
 * // Create webhook credentials
 * const webhookBuilder = createWebhookCredentialBuilder({
 *   privateKeyPem: merchantKey,
 *   merchantDid: "did:wba:merchant",
 *   shopperDid: "did:wba:shopper",
 *   algorithm: "ES256K"
 * });
 * 
 * const paymentReceipt = await webhookBuilder.buildPaymentReceipt(
 *   receiptContents,
 *   hash,
 *   pmtHash
 * );
 * ```
 * 
 * @packageDocumentation
 */

// ============================================
// High-level API (Recommended)
// ============================================

export {
  createCartBuilder,
  createPaymentBuilder,
  createWebhookCredentialBuilder,
  CartBuilder,
  PaymentBuilder,
  WebhookCredentialBuilder,
} from "./builders.js";

export type {
  CartBuilderConfig,
  PaymentBuilderConfig,
  WebhookCredentialBuilderConfig,
  Signer,
  Logger,
} from "./builders.js";

// ============================================
// Types (from types/ directory)
// ============================================

export type {
  // Common
  MoneyAmount,
  DisplayItem,
  ShippingAddress,
  QRCodePaymentData,
  PaymentMethodData,
  PaymentDetails,
  PaymentDetailsTotal,
  PaymentRequestOptions,
  PaymentRequest,
  PaymentResponse,
  
  // Cart
  CartContents,
  CartMandateRequest,
  CartMandateResponse,
  CartMandateJWSPayload,
  CartMandate,
  
  // Payment
  PaymentMandateContents,
  PaymentMandateRequest,
  PaymentMandateResponse,
  PaymentMandateJWSPayload,
  PaymentMandate,
  
  // Webhook
  PaymentReceiptContents,
  PaymentReceipt,
  FulfillmentReceiptContents,
  FulfillmentReceipt,
  WebhookCredentialJWSPayload,
  WebhookResponse,
  Credential,
} from "./types/index.js";

// ============================================
// Schemas (for runtime validation)
// ============================================

export {
  // Common
  MoneyAmountSchema,
  DisplayItemSchema,
  ShippingAddressSchema,
  QRCodePaymentDataSchema,
  PaymentMethodDataSchema,
  PaymentDetailsSchema,
  PaymentDetailsTotalSchema,
  PaymentRequestOptionsSchema,
  PaymentRequestSchema,
  PaymentResponseSchema,
  
  // Cart
  CartContentsSchema,
  CartMandateRequestSchema,
  CartMandateResponseSchema,
  CartMandateJWSPayloadSchema,
  CartMandateSchema,
  
  // Payment
  PaymentMandateContentsSchema,
  PaymentMandateRequestSchema,
  PaymentMandateResponseSchema,
  PaymentMandateJWSPayloadSchema,
  PaymentMandateSchema,
  
  // Webhook
  PaymentReceiptContentsSchema,
  PaymentReceiptSchema,
  FulfillmentReceiptContentsSchema,
  FulfillmentReceiptSchema,
  WebhookCredentialJWSPayloadSchema,
  WebhookResponseSchema,
  CredentialSchema,
} from "./types/index.js";

// ============================================
// Utils
// ============================================

export { 
  cartHash, 
  paymentMandateHash,
  contentHash,
  jcs, 
  sha256B64Url 
} from "./utils.js";

// ============================================
// Constants
// ============================================

export { ANP_AP2_DEFAULTS, ANP_AP2_VERSION } from "./constants.js";
export type { SupportedJwsAlg } from "./constants.js";

// ============================================
// Errors
// ============================================

export {
  AP2Error,
  MandateBuildError,
  SchemaValidationError,
  MandateVerificationError,
  CartHashMismatchError,
  JwtVerificationError,
  JwtSigningError,
  InvalidKeyError,
  AP2NetworkError,
} from "./errors.js";
