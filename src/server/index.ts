import { zodToJsonSchema } from "zod-to-json-schema";
import type { Agent, AgentConfig, CapabilityConfig, ResourceConfig, Context, ServeOptions } from "./types.js";
import { CapabilityRegistry, handleJSONRPC, type JSONRPCRequest } from "./handler.js";
import { SessionStore, SessionImpl } from "./session.js";
import { createVerifier, type Verifier } from "../client/verifier.js";
import type { Router } from "./routing.js";

export * from "./types.js";
export * from "./decorators.js";
export * from "./routing.js";

/**
 * Create an Agent instance
 * 
 * @example
 * ```typescript
 * import { createAgent } from "anp-ts/server";
 * import { z } from "zod";
 * 
 * const agent = createAgent({
 *   name: "My Agent",
 *   did: "did:wba:example.com",
 *   privateKey: myKey
 * });
 * 
 * agent.capability("hello", {
 *   params: z.object({ name: z.string() }),
 *   handler: async ({ name }) => ({ message: `Hello, ${name}!` })
 * });
 * 
 * await agent.serve({ port: 3000 });
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  const registry = new CapabilityRegistry();
  const sessionStore = new SessionStore();
  const verifier: Verifier | undefined = config.authEnabled ? createVerifier() : undefined;

  const baseUrl = config.baseUrl || (config.did.startsWith("did:wba:") 
    ? `https://${config.did.replace("did:wba:", "")}`
    : undefined);

  if (!baseUrl) {
    throw new Error("baseUrl is required when DID is not did:wba format");
  }

  const agent: Agent = {
    config,

    capability<TParams = unknown, TResult = unknown>(
      name: string,
      capabilityConfig: CapabilityConfig<TParams, TResult>
    ): Agent {
      registry.register(name, capabilityConfig);
      return agent;
    },

    resource(name: string, resourceConfig: ResourceConfig): Agent {
      const methods = ["list", "get", "create", "update", "delete"] as const;

      for (const method of methods) {
        if (resourceConfig[method]) {
          registry.register(`${name}.${method}`, resourceConfig[method]!);
        }
      }

      if (resourceConfig.custom) {
        for (const [customMethod, customConfig] of Object.entries(resourceConfig.custom)) {
          registry.register(`${name}.${customMethod}`, customConfig);
        }
      }

      return agent;
    },

    useRouter(router: Router): Agent {
      // Register all capabilities from router
      for (const [name, config] of router.getCapabilities()) {
        const wrappedHandler = router.wrapHandler(config.handler);
        registry.register(name, {
          ...config,
          handler: wrappedHandler,
        });
      }

      // Register all resources from router
      for (const [name, config] of router.getResources()) {
        const methods = ["list", "get", "create", "update", "delete"] as const;
        
        for (const method of methods) {
          if (config[method]) {
            const wrappedHandler = router.wrapHandler(config[method]!.handler);
            registry.register(`${name}.${method}`, {
              ...config[method]!,
              handler: wrappedHandler,
            });
          }
        }

        if (config.custom) {
          for (const [customMethod, customConfig] of Object.entries(config.custom)) {
            const wrappedHandler = router.wrapHandler(customConfig.handler);
            registry.register(`${name}.${customMethod}`, {
              ...customConfig,
              handler: wrappedHandler,
            });
          }
        }
      }

      return agent;
    },

    async handleRequest(request: Request): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/ad.json") {
        return new Response(JSON.stringify(getAgentDescription()), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (request.method === "GET" && url.pathname === "/openrpc.json") {
        return new Response(JSON.stringify(getOpenRPC()), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (request.method === "POST" && url.pathname === "/rpc") {
        return await handleRPCRequest(request);
      }

      return new Response("Not Found", { status: 404 });
    },

    async serve(options?: ServeOptions): Promise<void> {
      return serve(agent, options);
    },
  };

  function getAgentDescription() {
    const capabilities = registry.getAll();
    return {
      name: config.name,
      description: config.description,
      version: config.version || "1.0.0",
      did: config.did,
      interfaces: capabilities.map(([name, cap]) => ({
        type: "link",
        url: `${baseUrl}/rpc`,
        description: cap.description || name,
      })),
      metadata: config.metadata,
    };
  }

  function getOpenRPC() {
    const capabilities = registry.getAll();
    return {
      openrpc: "1.3.2",
      info: {
        title: config.name,
        description: config.description,
        version: config.version || "1.0.0",
      },
      methods: capabilities.map(([name, cap]) => ({
        name,
        description: cap.description,
        params: cap.params
          ? [
              {
                name: "params",
                required: true,
                schema: zodToJsonSchema(cap.params),
              },
            ]
          : [],
        result: cap.returns
          ? {
              name: "result",
              schema: zodToJsonSchema(cap.returns),
            }
          : undefined,
      })),
    };
  }

  async function handleRPCRequest(request: Request): Promise<Response> {
    try {
      let did: string | undefined;

      if (config.authEnabled && verifier) {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32004, message: "Authorization header is required" },
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        const body = await request.text();
        const result = await verifier.verify(authHeader, {
          method: request.method,
          url: request.url,
          body,
        });

        if (!result.verified || !result.did) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32004, message: result.error || "Authentication failed" },
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        did = result.did;
      }

      const body = await (request.headers.get("Authorization")
        ? Promise.resolve(await request.clone().text())
        : request.text());
      const jsonrpcRequest = JSON.parse(body) as JSONRPCRequest;

      const session = did ? sessionStore.getOrCreate(did) : new SessionImpl("anonymous");

      const context: Context = {
        did,
        session,
        metadata: {},
      };

      const jsonrpcResponse = await handleJSONRPC(jsonrpcRequest, registry, context);

      return new Response(JSON.stringify(jsonrpcResponse), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return agent;
}

/**
 * Start the agent server (standalone function)
 * 
 * @param agent - Agent instance
 * @param options - Serve options
 */
export async function serve(agent: Agent, options?: ServeOptions): Promise<void> {
  const port = options?.port ?? 3000;
  const hostname = options?.hostname ?? "0.0.0.0";

  if (typeof Bun !== "undefined") {
    Bun.serve({
      port,
      hostname,
      fetch: agent.handleRequest.bind(agent),
    });
  } else if (typeof Deno !== "undefined") {
    // @ts-ignore Deno global
    Deno.serve({ port, hostname }, agent.handleRequest.bind(agent));
  } else {
    throw new Error(
      "serve() is only supported in Bun and Deno. For other runtimes, use agent.handleRequest() with your HTTP server."
    );
  }

  console.log(`🚀 Agent "${agent.config.name}" listening on http://${hostname}:${port}`);
  console.log(`   DID: ${agent.config.did}`);
  console.log(`   GET  /ad.json       - Agent Description`);
  console.log(`   GET  /openrpc.json  - OpenRPC Specification`);
  console.log(`   POST /rpc           - JSON-RPC Endpoint`);
}
