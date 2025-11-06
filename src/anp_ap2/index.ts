import * as models from "./models/index.js";
import { CartMandateBuilder, createCartMandateBuilder } from "./builders/cart.js";
import { PaymentMandateBuilder, createPaymentMandateBuilder } from "./builders/payment.js";
import { BaseMandateBuilder } from "./builders/base.js";
import { cartHash, jcs, sha256B64Url } from "./utils/canonical.js";
import { AP2_DEFAULTS, AP2_VERSION, type SupportedJwsAlg } from "./constants.js";
import * as errors from "./errors.js";
import { AP2Client, createAp2Client, type AP2ClientOptions, type SendPaymentMandateResponse } from "./services/client.js";
import {
  verifyCartMandate,
  verifyPaymentMandate,
  mandateVerifier,
  type CartMandateVerifyOptions,
  type PaymentMandateVerifyOptions,
} from "./services/verifier.js";
import {
  ajvValidators,
  jsonSchemas,
  validateCartContents,
  validateCartMandate,
  validatePaymentMandate,
  validatePaymentMandateContents,
  validatePaymentRequest,
  validatePaymentResponse,
  type ValidationResult,
} from "./validation/ajv.js";

export {
  models,
  errors,
  BaseMandateBuilder,
  type SupportedJwsAlg,
  CartMandateBuilder,
  createCartMandateBuilder,
  PaymentMandateBuilder,
  createPaymentMandateBuilder,
  cartHash,
  jcs,
  sha256B64Url,
  AP2Client,
  createAp2Client,
  type AP2ClientOptions,
  type SendPaymentMandateResponse,
  verifyCartMandate,
  verifyPaymentMandate,
  mandateVerifier,
  type CartMandateVerifyOptions,
  type PaymentMandateVerifyOptions,
  ajvValidators,
  jsonSchemas,
  validateCartMandate,
  validateCartContents,
  validatePaymentMandate,
  validatePaymentMandateContents,
  validatePaymentRequest,
  validatePaymentResponse,
  type ValidationResult,
  AP2_DEFAULTS,
  AP2_VERSION,
};

export const ap2 = {
  models,
  errors,
  builders: {
    createCartMandateBuilder,
    createPaymentMandateBuilder,
  },
  services: {
    createAp2Client,
    AP2Client,
  },
  verifiers: mandateVerifier,
  validation: ajvValidators,
  utils: {
    cartHash,
    jcs,
    sha256B64Url,
  },
  constants: {
    AP2_DEFAULTS,
    AP2_VERSION,
  },
};


