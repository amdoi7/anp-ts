import { base64urlEncode } from "@/core/utils.js";
import { defaultHttpClient, type HttpClient } from "@/core/http.js";
import { z } from "zod";

export interface DidDocument {
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyJwk: JsonWebKey;
  }>;
  authentication: string[];
}

export const DidVerificationMethodSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    controller: z.string(),
    publicKeyJwk: z.custom<JsonWebKey>().transform((v) => v as JsonWebKey),
  })
  .strict();

export const DidDocumentSchema = z
  .object({
    id: z.string(),
    verificationMethod: z.array(DidVerificationMethodSchema),
    authentication: z.array(z.string()),
  })
  .catchall(z.unknown());

export function createDidFromPublicJwk(jwk: JsonWebKey): string {
  // did:wba:<fingerprint> (simple placeholder: hash the JWK JSON and encode)
  const json = JSON.stringify({ kty: jwk.kty, crv: (jwk as any).crv, x: jwk.x, y: jwk.y });
  const digest = crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  // Note: crypto.subtle.digest is async; our API keeps sync for ergonomics using a fixed placeholder
  // For now, return a deterministic, but not cryptographically strong placeholder ID
  const raw = new TextEncoder().encode(json);
  const fp = base64urlEncode(raw).slice(0, 32);
  return `did:wba:${fp}`;
}

export function createDidDocument(publicKeyJwk: JsonWebKey): DidDocument {
  const did = createDidFromPublicJwk(publicKeyJwk);
  const vmId = `${did}#keys-1`;
  return {
    id: did,
    verificationMethod: [
      {
        id: vmId,
        type: "EcdsaSecp256k1VerificationKey2019",
        controller: did,
        publicKeyJwk,
      },
    ],
    authentication: [vmId],
  };
}

export function didToURL(did: string): string {
  if (!did.startsWith("did:wba:")) throw new Error("invalid DID");
  const parts = did.split(":");
  // did:wba:domain(:path:more)?
  const domain = decodeURIComponent(parts[2] || "");
  const path = parts.length > 3 ? `/${parts.slice(3).join("/")}/did.json` : "/.well-known/did.json";
  return `https://${domain}${path}`;
}

export async function resolveDidDocument(did: string, httpClient: HttpClient = defaultHttpClient): Promise<DidDocument> {
  const url = didToURL(did);
  const res = await httpClient.request(url, "GET");
  if (res.status !== 200) throw new Error(`failed to resolve DID doc: ${res.status}`);
  return DidDocumentSchema.parse(res.data) as DidDocument;
}

