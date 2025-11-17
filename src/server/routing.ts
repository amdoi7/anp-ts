/**
 * Router System - Convention-based routing with DI support
 * 
 * Inspired by FastAPI/FastANP routing system:
 * - Convention over configuration
 * - Dependency injection
 * - Auto-tagging based on file paths
 * - Layered architecture support
 * 
 * @example
 * ```typescript
 * // Create router
 * const router = createRouter({
 *   prefix: "/api",
 *   tags: ["Weather API"],
 *   service: weatherService
 * });
 * 
 * // Add capabilities
 * router.capability("getCurrentWeather", {
 *   params: z.object({ city: z.string() }),
 *   handler: async ({ city }, ctx) => {
 *     return await ctx.service.getCurrentWeather(city);
 *   }
 * });
 * 
 * // Register with agent
 * agent.useRouter(router);
 * ```
 */

import type { CapabilityConfig, ResourceConfig, Context } from "./types.js";
import type { ZodSchema } from "zod";

/**
 * Router configuration
 */
export interface RouterConfig<TService = any> {
  /** Route prefix (e.g., "/api", "/weather") */
  prefix?: string;
  /** Tags for documentation/grouping */
  tags?: string[];
  /** Service instance (for DI) */
  service?: TService;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Router middleware function
 */
export type RouterMiddleware = (
  ctx: Context,
  next: () => Promise<any>
) => Promise<any>;

/**
 * Router class - manages a group of related capabilities
 */
export class Router<TService = any> {
  private capabilities: Map<string, CapabilityConfig> = new Map();
  private resources: Map<string, ResourceConfig> = new Map();
  private middlewares: RouterMiddleware[] = [];

  constructor(
    public readonly config: RouterConfig<TService> = {}
  ) {}

  /**
   * Register a capability
   */
  capability<TParams = unknown, TResult = unknown>(
    name: string,
    config: Omit<CapabilityConfig<TParams, TResult>, "handler"> & {
      handler: (
        params: TParams,
        ctx: Context & { service: TService }
      ) => Promise<TResult> | TResult;
    }
  ): this {
    const fullName = this.config.prefix
      ? `${this.config.prefix}.${name}`
      : name;

    this.capabilities.set(fullName, config as CapabilityConfig);
    return this;
  }

  /**
   * Register a resource
   */
  resource(name: string, config: ResourceConfig): this {
    const fullName = this.config.prefix
      ? `${this.config.prefix}.${name}`
      : name;

    this.resources.set(fullName, config);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: RouterMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Get all capabilities
   */
  getCapabilities(): Map<string, CapabilityConfig> {
    return this.capabilities;
  }

  /**
   * Get all resources
   */
  getResources(): Map<string, ResourceConfig> {
    return this.resources;
  }

  /**
   * Get middlewares
   */
  getMiddlewares(): RouterMiddleware[] {
    return this.middlewares;
  }

  /**
   * Wrap handler with middlewares
   */
  wrapHandler<TParams, TResult>(
    handler: (params: TParams, ctx: Context) => Promise<TResult> | TResult
  ): (params: TParams, ctx: Context) => Promise<TResult> {
    return async (params: TParams, ctx: Context) => {
      // Inject service into context
      const enhancedCtx = {
        ...ctx,
        service: this.config.service,
      };

      // Build middleware chain
      let index = 0;
      const next = async (): Promise<any> => {
        if (index < this.middlewares.length) {
          const middleware = this.middlewares[index++];
          return await middleware(enhancedCtx, next);
        }
        return await handler(params, enhancedCtx);
      };

      return await next();
    };
  }
}

/**
 * Create a router with auto-generated tags
 * 
 * Convention: agents/{service}/routers/{type}_router.ts
 * → Tag: "{Service} {Type}"
 * 
 * @example
 * ```typescript
 * // In agents/weather/routers/api_router.ts
 * const router = createTaggedRouter({
 *   prefix: "/weather",
 *   callerFile: import.meta.url
 * });
 * // Auto-generates tag: "Weather API"
 * ```
 */
export function createTaggedRouter<TService = any>(
  config: Omit<RouterConfig<TService>, "tags"> & {
    callerFile?: string;
  }
): Router<TService> {
  const tags = config.callerFile
    ? generateTagsFromPath(config.callerFile)
    : [];

  return new Router({
    ...config,
    tags,
  });
}

/**
 * Create a basic router
 */
export function createRouter<TService = any>(
  config: RouterConfig<TService> = {}
): Router<TService> {
  return new Router(config);
}

/**
 * Generate tags from file path
 * 
 * Examples:
 * - agents/weather/routers/api_router.ts → ["Weather API"]
 * - agents/lbs/routers/ad_router.ts → ["LBS Agent Description"]
 * - agents/tourist/routers/ticket_router.ts → ["Tourist - Tickets"]
 */
function generateTagsFromPath(filePath: string): string[] {
  // Extract from file:// URL if needed
  const path = filePath.replace(/^file:\/\//, "");

  // Match pattern: agents/{service}/routers/{type}_router
  const match = path.match(/agents\/([^\/]+)\/routers\/([^\/]+)_router/);
  if (!match) {
    return [];
  }

  const [, service, type] = match;

  // Convert service name: weather → Weather, tourist_attraction → Tourist Attraction
  const serviceName = service
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Convert type: api → API, ad → Agent Description
  const typeMap: Record<string, string> = {
    api: "API",
    ad: "Agent Description",
    jsonrpc: "JSON-RPC",
    interface: "Interface",
    pay: "Payments",
    ticket: "Tickets",
  };

  const typeName = typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);

  // Special handling for "Agent Description"
  if (type === "ad") {
    return [`${serviceName} ${typeName}`];
  }

  // For other types, use dash separator
  return [`${serviceName} - ${typeName}`];
}

/**
 * Router registry - manages multiple routers
 */
export class RouterRegistry {
  private routers: Router[] = [];

  /**
   * Register a router
   */
  register(router: Router): this {
    this.routers.push(router);
    return this;
  }

  /**
   * Get all routers
   */
  getRouters(): Router[] {
    return this.routers;
  }

  /**
   * Get all capabilities from all routers
   */
  getAllCapabilities(): Map<string, CapabilityConfig> {
    const all = new Map<string, CapabilityConfig>();
    for (const router of this.routers) {
      for (const [name, config] of router.getCapabilities()) {
        all.set(name, config);
      }
    }
    return all;
  }

  /**
   * Get all resources from all routers
   */
  getAllResources(): Map<string, ResourceConfig> {
    const all = new Map<string, ResourceConfig>();
    for (const router of this.routers) {
      for (const [name, config] of router.getResources()) {
        all.set(name, config);
      }
    }
    return all;
  }
}

/**
 * Common middleware functions
 */
export const middleware = {
  /**
   * Logging middleware
   */
  logging: (): RouterMiddleware => {
    return async (ctx, next) => {
      const start = Date.now();
      console.log(`[${new Date().toISOString()}] Request from ${ctx.did || "anonymous"}`);
      const result = await next();
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] Completed in ${duration}ms`);
      return result;
    };
  },

  /**
   * Authentication middleware
   */
  requireAuth: (): RouterMiddleware => {
    return async (ctx, next) => {
      if (!ctx.did) {
        throw new Error("Authentication required");
      }
      return await next();
    };
  },

  /**
   * Rate limiting middleware (simple implementation)
   */
  rateLimit: (config: { requests: number; windowMs: number }): RouterMiddleware => {
    const requests = new Map<string, number[]>();

    return async (ctx, next) => {
      const key = ctx.did || "anonymous";
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Get request timestamps for this key
      let timestamps = requests.get(key) || [];
      
      // Filter out old timestamps
      timestamps = timestamps.filter((ts) => ts > windowStart);

      // Check rate limit
      if (timestamps.length >= config.requests) {
        throw new Error("Rate limit exceeded");
      }

      // Add current timestamp
      timestamps.push(now);
      requests.set(key, timestamps);

      return await next();
    };
  },

  /**
   * Error handling middleware
   */
  errorHandler: (): RouterMiddleware => {
    return async (ctx, next) => {
      try {
        return await next();
      } catch (error) {
        console.error("Error in handler:", error);
        throw error;
      }
    };
  },
};
