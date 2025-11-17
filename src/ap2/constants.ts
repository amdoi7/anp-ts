/**
 * ANP_AP2 Constants - v1.0a
 */

export const ANP_AP2_VERSION = "1.0a";

export const ANP_AP2_DEFAULTS = {
  CART_TTL_SECONDS: 3600, // 1 hour
  PAYMENT_TTL_SECONDS: 300, // 5 minutes
  CREDENTIAL_TTL_SECONDS: 86400, // 24 hours
  DEFAULT_ALGORITHM: "RS256" as const,
} as const;

export type SupportedJwsAlg = "RS256" | "ES256K";
