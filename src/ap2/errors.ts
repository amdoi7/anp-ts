/**
 * AP2 Error Classes
 * @packageDocumentation
 */

/**
 * Base error for all AP2-related errors
 */
export class AP2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AP2Error";
  }
}

/**
 * Mandate build error
 */
export class MandateBuildError extends AP2Error {
  constructor(
    public readonly mandateType: string,
    message: string
  ) {
    super(`Failed to build ${mandateType} mandate: ${message}`);
    this.name = "MandateBuildError";
  }
}

/**
 * Schema validation error
 */
export class SchemaValidationError extends AP2Error {
  constructor(
    public readonly schemaName: string,
    message: string
  ) {
    super(`Schema validation failed for ${schemaName}: ${message}`);
    this.name = "SchemaValidationError";
  }
}

/**
 * Mandate verification error
 */
export class MandateVerificationError extends AP2Error {
  constructor(
    public readonly mandateType: string,
    message: string
  ) {
    super(`Failed to verify ${mandateType} mandate: ${message}`);
    this.name = "MandateVerificationError";
  }
}

/**
 * Cart hash mismatch error
 */
export class CartHashMismatchError extends MandateVerificationError {
  constructor(
    public readonly expected: string,
    public readonly actual: string
  ) {
    super("cart", `Cart hash mismatch: expected ${expected}, got ${actual}`);
    this.name = "CartHashMismatchError";
  }
}

/**
 * JWT verification error
 */
export class JwtVerificationError extends MandateVerificationError {
  constructor(message: string) {
    super("jwt", message);
    this.name = "JwtVerificationError";
  }
}

/**
 * JWT signing error
 */
export class JwtSigningError extends AP2Error {
  constructor(message: string) {
    super(`JWT signing failed: ${message}`);
    this.name = "JwtSigningError";
  }
}

/**
 * Invalid key error
 */
export class InvalidKeyError extends AP2Error {
  constructor(message: string) {
    super(`Invalid key: ${message}`);
    this.name = "InvalidKeyError";
  }
}

/**
 * Network error
 */
export class AP2NetworkError extends AP2Error {
  constructor(
    public readonly statusCode?: number,
    message?: string
  ) {
    super(message ?? `Network request failed with status ${statusCode}`);
    this.name = "AP2NetworkError";
  }
}
