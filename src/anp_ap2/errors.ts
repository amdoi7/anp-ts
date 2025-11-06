/**
 * Base error class for all AP2-related errors.
 */
export class AP2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AP2Error";
  }
}

/**
 * Base error class for all mandate verification failures.
 */
export class MandateVerificationError extends AP2Error {
  constructor(message: string) {
    super(message);
    this.name = "MandateVerificationError";
  }
}

/**
 * Thrown when the cart hash in a mandate does not match the expected value.
 */
export class CartHashMismatchError extends MandateVerificationError {
  constructor() {
    super("Cart hash does not match the expected value.");
    this.name = "CartHashMismatchError";
  }
}

/**
 * Thrown when JWT signature verification fails.
 */
export class JwtVerificationError extends MandateVerificationError {
  constructor(message: string) {
    super(`JWT verification failed: ${message}`);
    this.name = "JwtVerificationError";
  }
}

/**
 * Thrown when JWT signing fails during mandate creation.
 */
export class JwtSigningError extends AP2Error {
  constructor(message: string) {
    super(`JWT signing failed: ${message}`);
    this.name = "JwtSigningError";
  }
}

/**
 * Thrown when data validation against schema fails.
 */
export class SchemaValidationError extends AP2Error {
  constructor(schemaName: string, details?: string) {
    super(`Schema validation failed for ${schemaName}${details ? `: ${details}` : ""}`);
    this.name = "SchemaValidationError";
  }
}

/**
 * Thrown when an invalid public or private key is provided.
 */
export class InvalidKeyError extends AP2Error {
  constructor(keyType: "public" | "private", message?: string) {
    super(`Invalid ${keyType} key${message ? `: ${message}` : ""}`);
    this.name = "InvalidKeyError";
  }
}

/**
 * Thrown when AP2 HTTP requests fail.
 */
export class AP2NetworkError extends AP2Error {
  constructor(
    public readonly url: string,
    public readonly statusCode?: number,
    message?: string,
  ) {
    super(`Network request failed for ${url}${statusCode ? ` (HTTP ${statusCode})` : ""}${message ? `: ${message}` : ""}`);
    this.name = "AP2NetworkError";
  }
}

/**
 * Thrown when mandate building fails.
 */
export class MandateBuildError extends AP2Error {
  constructor(mandateType: "cart" | "payment", message: string) {
    super(`Failed to build ${mandateType} mandate: ${message}`);
    this.name = "MandateBuildError";
  }
}
