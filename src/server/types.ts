import type { ZodSchema } from "zod";

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Agent description */
  description?: string;
  /** Agent version */
  version?: string;
  /** DID identifier */
  did: string;
  /** Private key for signing (JWK format) */
  privateKey?: JsonWebKey;
  /** Base URL (optional, derived from DID if not provided) */
  baseUrl?: string;
  /** Enable DID-WBA authentication */
  authEnabled?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Capability configuration
 */
export interface CapabilityConfig<TParams = unknown, TResult = unknown> {
  /** Capability description */
  description?: string;
  /** Parameter schema (Zod) */
  params?: ZodSchema<TParams>;
  /** Return value schema (Zod) */
  returns?: ZodSchema<TResult>;
  /** Capability handler function */
  handler: CapabilityHandler<TParams, TResult>;
  /** Require authentication (default: false) */
  requiresAuth?: boolean;
}

/**
 * Capability handler function type
 */
export type CapabilityHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: Context
) => Promise<TResult> | TResult;

/**
 * Execution context passed to handlers
 * 
 * Contains only request-level information, no state management.
 * If you need session/cache, implement it yourself (Redis, JWT, etc.)
 */
export interface Context {
  /** Caller DID (if authenticated) */
  readonly did?: string;
  
  /** Request metadata (trace_id, client_version, etc.) */
  readonly metadata: Record<string, unknown>;
  
  /** Original request information */
  readonly request: {
    /** HTTP method */
    method: string;
    /** Request URL */
    url: string;
    /** HTTP headers */
    headers: Record<string, string>;
    /** Request body (parsed) */
    body?: unknown;
  };
}



/**
 * Resource configuration (Google API style)
 */
export interface ResourceConfig {
  /** List method */
  list?: CapabilityConfig;
  /** Get method */
  get?: CapabilityConfig;
  /** Create method */
  create?: CapabilityConfig;
  /** Update method */
  update?: CapabilityConfig;
  /** Delete method */
  delete?: CapabilityConfig;
  /** Custom methods */
  custom?: Record<string, CapabilityConfig>;
}

/**
 * Agent instance
 */
export interface Agent {
  /** Agent configuration */
  readonly config: AgentConfig;
  
  /**
   * Register a capability (method)
   * @param name - Capability name
   * @param config - Capability configuration
   * @returns Agent instance (for chaining)
   */
  capability<TParams = unknown, TResult = unknown>(
    name: string,
    config: CapabilityConfig<TParams, TResult>
  ): Agent;
  
  /**
   * Register a resource (CRUD collection)
   * @param name - Resource name
   * @param config - Resource configuration
   * @returns Agent instance (for chaining)
   */
  resource(name: string, config: ResourceConfig): Agent;
  
  /**
   * Register a router
   * @param router - Router instance
   * @returns Agent instance (for chaining)
   */
  useRouter(router: any): Agent;
  
  /**
   * Handle HTTP request (for integration with HTTP servers)
   * @param request - Web Request object
   * @returns Web Response object
   */
  handleRequest(request: Request): Promise<Response>;
  
  /**
   * Start the agent server
   * @param options - Serve options
   */
  serve(options?: ServeOptions): Promise<void>;
}

/**
 * Server options
 */
export interface ServeOptions {
  /** Port number (default: 3000) */
  port?: number;
  /** Hostname (default: "0.0.0.0") */
  hostname?: string;
}
