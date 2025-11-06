import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  CartContentsSchema,
  CartMandateSchema,
  PaymentMandateContentsSchema,
  PaymentMandateSchema,
  PaymentRequestSchema,
  PaymentResponseSchema,
  type CartContents,
  type CartMandate,
  type PaymentMandate,
  type PaymentMandateContents,
  type PaymentRequest,
  type PaymentResponse,
} from "../models/index.js";

export interface ValidationResult<T> {
  valid: boolean;
  errors: ErrorObject[] | null;
}

interface CompiledValidator<T> {
  jsonSchema: unknown;
  validate: ValidateFunction<T>;
}

const ajv = new (Ajv as any)({
  allErrors: true,
  allowUnionTypes: true,
  strict: true,
  verbose: true,
  validateFormats: true,
});

function compileValidator<T>(schema: Parameters<typeof zodToJsonSchema>[0], schemaName: string): CompiledValidator<T> {
  const jsonSchema = zodToJsonSchema(schema, {
    name: schemaName,
    target: "jsonSchema7",
    $refStrategy: "none",
  });
  return {
    jsonSchema,
    validate: ajv.compile(jsonSchema as any) as ValidateFunction<T>,
  };
}

function createResult<T>(validator: ValidateFunction<T>, data: unknown): ValidationResult<T> {
  const valid = validator(data) as boolean;
  return { valid, errors: valid ? null : validator.errors ?? null };
}

const validators = {
  cartMandate: compileValidator<CartMandate>(CartMandateSchema, "CartMandate"),
  cartContents: compileValidator<CartContents>(CartContentsSchema, "CartContents"),
  paymentMandate: compileValidator<PaymentMandate>(PaymentMandateSchema, "PaymentMandate"),
  paymentMandateContents: compileValidator<PaymentMandateContents>(PaymentMandateContentsSchema, "PaymentMandateContents"),
  paymentRequest: compileValidator<PaymentRequest>(PaymentRequestSchema, "PaymentRequest"),
  paymentResponse: compileValidator<PaymentResponse>(PaymentResponseSchema, "PaymentResponse"),
} as const;

export const jsonSchemas = {
  cartMandate: validators.cartMandate.jsonSchema,
  cartContents: validators.cartContents.jsonSchema,
  paymentMandate: validators.paymentMandate.jsonSchema,
  paymentMandateContents: validators.paymentMandateContents.jsonSchema,
  paymentRequest: validators.paymentRequest.jsonSchema,
  paymentResponse: validators.paymentResponse.jsonSchema,
} as const;

export function validateCartMandate(data: unknown): ValidationResult<CartMandate> {
  return createResult(validators.cartMandate.validate, data);
}

export function validateCartContents(data: unknown): ValidationResult<CartContents> {
  return createResult(validators.cartContents.validate, data);
}

export function validatePaymentMandate(data: unknown): ValidationResult<PaymentMandate> {
  return createResult(validators.paymentMandate.validate, data);
}

export function validatePaymentMandateContents(data: unknown): ValidationResult<PaymentMandateContents> {
  return createResult(validators.paymentMandateContents.validate, data);
}

export function validatePaymentRequest(data: unknown): ValidationResult<PaymentRequest> {
  return createResult(validators.paymentRequest.validate, data);
}

export function validatePaymentResponse(data: unknown): ValidationResult<PaymentResponse> {
  return createResult(validators.paymentResponse.validate, data);
}

export const ajvValidators = {
  validateCartMandate,
  validateCartContents,
  validatePaymentMandate,
  validatePaymentMandateContents,
  validatePaymentRequest,
  validatePaymentResponse,
};


