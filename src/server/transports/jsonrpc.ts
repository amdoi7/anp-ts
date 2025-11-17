/**
 * JSON-RPC 2.0 Transport Handler
 * 
 * Implements JSON-RPC 2.0 specification for ANP protocol.
 * 
 * @see https://www.jsonrpc.org/specification
 */

import type {
  Transport,
  TransportContext,
  TransportMetadata,
  InterfaceRegistry,
  MethodInvoker,
} from "./base.js";

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id?: string | number | null;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: JSONRPCError;
  id?: string | number | null;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC error codes
 */
export const JSONRPCErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * JSON-RPC Transport
 */
export class JSONRPCTransport implements Transport {
  constructor(
    private registry: InterfaceRegistry,
    private invoker: MethodInvoker
  ) {}

  /**
   * Handle JSON-RPC request
   */
  async handle(
    request: unknown,
    context?: TransportContext
  ): Promise<JSONRPCResponse> {
    try {
      // Validate request format
      if (!this.isValidRequest(request)) {
        return this.createErrorResponse(
          null,
          JSONRPCErrorCode.INVALID_REQUEST,
          "Invalid Request"
        );
      }

      const req = request as JSONRPCRequest;

      // Find method
      const method = this.registry.findMethod(req.method);
      if (!method) {
        return this.createErrorResponse(
          req.id,
          JSONRPCErrorCode.METHOD_NOT_FOUND,
          `Method not found: ${req.method}`
        );
      }

      // Invoke method
      try {
        const result = await this.invoker.invoke(
          method,
          req.params,
          context
        );

        return {
          jsonrpc: "2.0",
          result,
          id: req.id,
        };
      } catch (error) {
        return this.createErrorResponse(
          req.id,
          JSONRPCErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Internal error",
          error instanceof Error ? { stack: error.stack } : undefined
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        null,
        JSONRPCErrorCode.INTERNAL_ERROR,
        "Internal error"
      );
    }
  }

  /**
   * Get transport metadata
   */
  getMetadata(): TransportMetadata {
    return {
      name: "JSON-RPC",
      version: "2.0",
      features: ["batch", "notifications"],
    };
  }

  /**
   * Validate JSON-RPC request
   */
  private isValidRequest(request: unknown): boolean {
    if (!request || typeof request !== "object") {
      return false;
    }

    const req = request as any;
    return (
      req.jsonrpc === "2.0" &&
      typeof req.method === "string" &&
      (req.id === undefined ||
        req.id === null ||
        typeof req.id === "string" ||
        typeof req.id === "number")
    );
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number | null | undefined,
    code: number,
    message: string,
    data?: unknown
  ): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        ...(data !== undefined && { data }),
      },
      id: id ?? null,
    };
  }
}

/**
 * Create JSON-RPC transport
 */
export function createJSONRPCTransport(
  registry: InterfaceRegistry,
  invoker: MethodInvoker
): JSONRPCTransport {
  return new JSONRPCTransport(registry, invoker);
}
