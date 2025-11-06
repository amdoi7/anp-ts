/**
 * Default configuration values for AP2 protocol.
 */
export const AP2_DEFAULTS = {
  /**
   * Default TTL for cart mandates (15 minutes).
   */
  CART_TTL_SECONDS: 15 * 60,

  /**
   * Default TTL for payment mandates (180 days).
   */
  PAYMENT_TTL_SECONDS: 180 * 24 * 60 * 60,

  /**
   * Default JWT signing algorithm.
   */
  DEFAULT_ALGORITHM: "RS256" as const,

  /**
   * Default AP2 endpoint paths.
   */
  ENDPOINTS: {
    CREATE_CART_MANDATE: "/ap2/create_cart_mandate",
    PAYMENT_MANDATE: "/ap2/payment_mandate",
  },
} as const;

/**
 * Supported JWT signing algorithms for AP2.
 * Matches Python PyJWT implementation.
 *
 * - RS256: RSASSA-PKCS1-v1_5 using SHA-256 (default)
 * - ES256K: ECDSA using secp256k1 curve and SHA-256 (for blockchain/crypto apps)
 */
export type SupportedJwsAlg = "RS256" | "ES256K";

/**
 * AP2 protocol version.
 */
export const AP2_VERSION = "1.0.0";

