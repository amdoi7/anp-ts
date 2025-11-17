/**
 * Transport Layer Abstraction
 * 
 * Provides protocol-agnostic RPC handling.
 * SDK only cares about: request → method → response
 */

/**
 * Transport interface - protocol agnostic
 */
export interface Transport {
  /**
   * Handle a raw request
   * @param request - Protocol-specific request
   * @param context - Request context
   * @returns Protocol-specific response
   */
  handle(request: unknown, context?: TransportContext): Promise<unknown>;

  /**
   * Get transport metadata
   */
  getMetadata(): TransportMetadata;
}

/**
 * Transport context
 */
export interface TransportContext {
  /** Caller DID (if authenticated) */
  did?: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Transport metadata
 */
export interface TransportMetadata {
  /** Transport name */
  name: string;
  /** Transport version */
  version: string;
  /** Supported features */
  features?: string[];
}

/**
 * Method metadata
 */
export interface MethodMetadata {
  /** Method name */
  name: string;
  /** Method description */
  description?: string;
  /** Handler function */
  handler: Function;
  /** Parameter types */
  paramTypes?: any[];
  /** Return type */
  returnType?: any;
}

/**
 * Interface registry - stores all registered interfaces and methods
 */
export class InterfaceRegistry {
  private methods: Map<string, MethodMetadata> = new Map();
  private interfaces: Map<string, InterfaceMetadata> = new Map();

  /**
   * Register a method
   */
  registerMethod(name: string, metadata: MethodMetadata): void {
    this.methods.set(name, metadata);
  }

  /**
   * Register an interface
   */
  registerInterface(name: string, metadata: InterfaceMetadata): void {
    this.interfaces.set(name, metadata);
  }

  /**
   * Find a method by name
   */
  findMethod(name: string): MethodMetadata | undefined {
    return this.methods.get(name);
  }

  /**
   * Get all methods
   */
  getAllMethods(): Map<string, MethodMetadata> {
    return this.methods;
  }

  /**
   * Get all interfaces
   */
  getAllInterfaces(): Map<string, InterfaceMetadata> {
    return this.interfaces;
  }
}

/**
 * Interface metadata
 */
export interface InterfaceMetadata {
  name: string;
  version?: string;
  description?: string;
  methods: Map<string, MethodMetadata>;
}

/**
 * Method invoker - handles method execution with validation
 */
export class MethodInvoker {
  async invoke(
    method: MethodMetadata,
    params: unknown,
    context: TransportContext = {}
  ): Promise<unknown> {
    // Create context object
    const ctx = {
      did: context.did,
      metadata: context.metadata || {},
    };

    // Call method with params and context
    if (Array.isArray(params)) {
      return await method.handler(...params, ctx);
    } else if (params !== null && typeof params === "object") {
      return await method.handler(params, ctx);
    } else {
      return await method.handler(params, ctx);
    }
  }
}
