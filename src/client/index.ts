/**
 * Client module - Integrates auth and crawler for discovering and calling agents
 */

import { createAuthenticator, type Authenticator } from "./authenticator.js";
import { Crawler } from "./crawler.js";
import { defaultHttpClient, type HttpClient } from "../core/http.js";

// Re-export auth
export { Authenticator, createAuthenticator } from "./authenticator.js";
export type { AuthenticatorConfig } from "./authenticator.js";
export { Verifier, createVerifier } from "./verifier.js";
export type { VerifierConfig, VerifyOptions, VerificationResult } from "./verifier.js";

// Re-export crawler
export { Crawler, createCrawler, fetchInterface } from "./crawler.js";
export type { CrawlerConfig, CrawlerInterface, CrawlerEndpoint } from "./crawler.js";

export interface AgentClientConfig {
  did: string;
  baseUrl?: string;
  httpClient?: HttpClient;
  privateKey?: JsonWebKey;
}

export interface AgentClient {
  readonly did: string;
  readonly baseUrl: string;
  call<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams
  ): Promise<TResult>;
  getAgentDescription(): Promise<AgentDescription>;
  getOpenRPC(): Promise<OpenRPCDocument>;
}

export interface AgentDescription {
  name: string;
  description?: string;
  version?: string;
  did: string;
  interfaces: InterfaceLink[];
  metadata?: Record<string, unknown>;
}

export interface InterfaceLink {
  type: "link";
  url: string;
  description?: string;
}

export interface OpenRPCDocument {
  openrpc: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  methods: OpenRPCMethod[];
}

export interface OpenRPCMethod {
  name: string;
  description?: string;
  params?: unknown[];
  result?: unknown;
}

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function createClient(config: AgentClientConfig): AgentClient {
  const httpClient = config.httpClient || defaultHttpClient;

  let baseUrl = config.baseUrl;
  if (!baseUrl) {
    if (config.did.startsWith("did:wba:")) {
      baseUrl = `https://${config.did.replace("did:wba:", "")}`;
    } else {
      throw new Error("baseUrl is required when DID is not did:wba format");
    }
  }

  let authenticator: Authenticator | undefined;
  if (config.privateKey) {
    authenticator = createAuthenticator({
      did: config.did,
      privateKey: config.privateKey,
    });
  }

  let idCounter = 0;

  return {
    did: config.did,
    baseUrl,

    async call<TParams = unknown, TResult = unknown>(
      method: string,
      params?: TParams
    ): Promise<TResult> {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: `${Date.now()}-${++idCounter}`,
        method,
        params,
      };

      const url = `${baseUrl}/rpc`;
      const body = JSON.stringify(request);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (authenticator) {
        const authHeader = await authenticator.createAuthHeader(
          "POST",
          url,
          body
        );
        headers["Authorization"] = authHeader;
      }

      const response = await httpClient.request<JSONRPCResponse>(url, "POST", {
        headers,
        body,
      });

      if (response.data.error) {
        throw new Error(
          `JSON-RPC Error ${response.data.error.code}: ${response.data.error.message}`
        );
      }

      return response.data.result as TResult;
    },

    async getAgentDescription(): Promise<AgentDescription> {
      const response = await httpClient.request<AgentDescription>(
        `${baseUrl}/ad.json`,
        "GET"
      );
      return response.data;
    },

    async getOpenRPC(): Promise<OpenRPCDocument> {
      const response = await httpClient.request<OpenRPCDocument>(
        `${baseUrl}/openrpc.json`,
        "GET"
      );
      return response.data;
    },
  };
}

export async function discover(
  did: string,
  options?: {
    httpClient?: HttpClient;
    privateKey?: JsonWebKey;
  }
): Promise<AgentClient> {
  const httpClient = options?.httpClient || defaultHttpClient;
  const crawler = new Crawler({ httpClient });

  let baseUrl: string;

  if (did.startsWith("did:wba:")) {
    baseUrl = `https://${did.replace("did:wba:", "")}`;
  } else if (did.startsWith("did:web:")) {
    const didDocUrl = didToDidDocumentUrl(did);
    const response = await httpClient.request(didDocUrl, "GET");
    const didDoc = response.data as any;

    const serviceEndpoint = didDoc.service?.find(
      (s: any) => s.type === "ANPAgent"
    )?.serviceEndpoint;

    if (!serviceEndpoint) {
      throw new Error(`No ANPAgent service found in DID document for ${did}`);
    }

    baseUrl = serviceEndpoint as string;
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }

  const client = createClient({
    did,
    baseUrl,
    httpClient,
    privateKey: options?.privateKey,
  });

  await client.getAgentDescription();

  return client;
}

function didToDidDocumentUrl(did: string): string {
  if (did.startsWith("did:web:")) {
    const parts = did.split(":");
    const domain = parts[2];
    const path = parts.slice(3).join("/");
    return path
      ? `https://${domain}/${path}/did.json`
      : `https://${domain}/.well-known/did.json`;
  }
  throw new Error("Only did:web is supported");
}
