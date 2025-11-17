/**
 * HTTP Transport Adapter
 * 
 * Adapts RPC transports to HTTP protocol.
 * Provides standard ANP endpoints: /rpc, /ad.json, /interface.json
 */

import type { Transport, InterfaceRegistry } from "./base.js";

/**
 * HTTP Transport configuration
 */
export interface HTTPTransportConfig {
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Agent version */
  version?: string;
  /** Agent DID */
  did: string;
  /** Agent metadata */
  metadata?: Record<string, unknown>;
}

/**
 * HTTP Transport Adapter
 */
export class HTTPTransportAdapter {
  constructor(
    private rpcTransport: Transport,
    private registry: InterfaceRegistry,
    private config: HTTPTransportConfig
  ) {}

  /**
   * Handle HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /rpc - JSON-RPC endpoint
    if (request.method === "POST" && url.pathname === "/rpc") {
      return await this.handleRPC(request);
    }

    // GET /ad.json - Agent Description
    if (request.method === "GET" && url.pathname === "/ad.json") {
      return this.handleAgentDescription();
    }

    // GET /interface.json - Interface Definition
    if (request.method === "GET" && url.pathname === "/interface.json") {
      return this.handleInterface();
    }

    // 404
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Handle RPC request
   */
  private async handleRPC(request: Request): Promise<Response> {
    try {
      const body = await request.json();

      // TODO: Extract DID from Authorization header
      const context = {
        did: undefined,
        metadata: {},
      };

      const result = await this.rpcTransport.handle(body, context);

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
          },
          id: null,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  /**
   * Handle Agent Description request
   */
  private handleAgentDescription(): Response {
    const methods = Array.from(this.registry.getAllMethods().entries());

    const ad = {
      name: this.config.name,
      description: this.config.description,
      version: this.config.version || "1.0.0",
      did: this.config.did,
      interfaces: methods.map(([name, method]) => ({
        type: "link",
        url: `/rpc`,
        description: method.description || name,
      })),
      metadata: this.config.metadata,
    };

    return new Response(JSON.stringify(ad, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Handle Interface Definition request
   */
  private handleInterface(): Response {
    const methods = Array.from(this.registry.getAllMethods().entries());

    const interfaceDoc = {
      interface: {
        name: this.config.name,
        version: this.config.version || "1.0.0",
        description: this.config.description,
        transport: "jsonrpc",
      },
      methods: methods.map(([name, method]) => ({
        name,
        description: method.description,
        params: {
          type: "object",
          properties: {},
        },
        returns: {
          type: "object",
          properties: {},
        },
      })),
    };

    return new Response(JSON.stringify(interfaceDoc, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
