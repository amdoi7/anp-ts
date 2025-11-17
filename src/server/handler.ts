import { ZodError } from "zod";
import type { CapabilityConfig, Context } from "./types.js";

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

export class CapabilityRegistry {
  private capabilities = new Map<string, CapabilityConfig>();

  register(name: string, config: CapabilityConfig): void {
    this.capabilities.set(name, config);
  }

  get(name: string): CapabilityConfig | undefined {
    return this.capabilities.get(name);
  }

  getAll(): Array<[string, CapabilityConfig]> {
    return Array.from(this.capabilities.entries());
  }
}

export async function handleJSONRPC(
  request: JSONRPCRequest,
  registry: CapabilityRegistry,
  context: Context
): Promise<JSONRPCResponse> {
  try {
    if (request.jsonrpc !== "2.0") {
      return createErrorResponse(request.id, -32600, "Invalid JSON-RPC version");
    }

    const capability = registry.get(request.method);
    if (!capability) {
      return createErrorResponse(request.id, -32601, `Method not found: ${request.method}`);
    }

    let params = request.params;
    if (capability.params) {
      try {
        params = await capability.params.parseAsync(request.params);
      } catch (error) {
        if (error instanceof ZodError) {
          return createErrorResponse(request.id, -32602, "Invalid parameters", {
            issues: error.issues,
          });
        }
        throw error;
      }
    }

    const result = await capability.handler(params, context);

    if (capability.returns) {
      try {
        await capability.returns.parseAsync(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return createErrorResponse(
            request.id,
            -32603,
            "Result validation failed",
            { issues: error.issues }
          );
        }
        throw error;
      }
    }

    return {
      jsonrpc: "2.0",
      id: request.id,
      result,
    };
  } catch (error) {
    return createErrorResponse(
      request.id,
      -32603,
      error instanceof Error ? error.message : "Internal error"
    );
  }
}

function createErrorResponse(
  id: JSONRPCRequest["id"],
  code: number,
  message: string,
  data?: unknown
): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}
