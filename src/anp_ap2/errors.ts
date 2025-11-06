/**
 * Base error class for all mandate verification failures.
 */
export class MandateVerificationError extends Error {
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
