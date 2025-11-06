/**
 * Base error class for all authenticator-related failures.
 */
export class AuthenticatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticatorError";
  }
}

/**
 * Base error class for all verifier-related failures.
 */
export class VerifierError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "VerifierError";
  }
}
