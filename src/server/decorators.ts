/**
 * Decorator API for defining ANP Agents
 * 
 * Provides a declarative way to define agents using TypeScript decorators,
 * inspired by NestJS and FastAPI.
 * 
 * @example
 * ```typescript
 * @Agent({
 *   name: "Weather Agent",
 *   did: "did:wba:weather.com",
 *   privateKey: myKey
 * })
 * class WeatherAgent {
 *   @Capability({ description: "Get current weather" })
 *   async getCurrentWeather({ city }: { city: string }) {
 *     return await weatherAPI.getCurrent(city);
 *   }
 * }
 * 
 * const agent = new WeatherAgent();
 * await agent.serve({ port: 3000 });
 * ```
 */

import type { AgentConfig, CapabilityConfig, ResourceConfig, ServeOptions, Agent as IAgent } from "./types.js";
import { createAgent } from "./index.js";
import type { ZodSchema } from "zod";

// Metadata keys for storing decorator information
const AGENT_METADATA_KEY = Symbol("anp:agent");
const CAPABILITIES_METADATA_KEY = Symbol("anp:capabilities");
const RESOURCE_METADATA_KEY = Symbol("anp:resource");

interface CapabilityMetadata {
  propertyKey: string;
  config: Partial<CapabilityConfig>;
}

interface ResourceMetadata {
  propertyKey: string;
  resourceName: string;
}

/**
 * @Agent decorator - marks a class as an ANP Agent
 * 
 * @param config - Agent configuration
 * 
 * @example
 * ```typescript
 * @Agent({
 *   name: "My Agent",
 *   did: "did:wba:example.com",
 *   privateKey: myKey
 * })
 * class MyAgent {
 *   @Capability()
 *   async myMethod() { }
 * }
 * ```
 */
export function Agent(config: Omit<AgentConfig, "baseUrl"> & { baseUrl?: string; port?: number }) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    // Store agent config in metadata
    Reflect.defineMetadata(AGENT_METADATA_KEY, config, constructor);

    // Create enhanced class that implements the Agent interface
    return class extends constructor {
      private _internalAgent?: IAgent;

      constructor(...args: any[]) {
        super(...args);
        this._initializeAgent();
      }

      private _initializeAgent() {
        // Get agent config from metadata
        const agentConfig = Reflect.getMetadata(AGENT_METADATA_KEY, constructor) as AgentConfig;
        
        // Create internal agent instance
        this._internalAgent = createAgent(agentConfig);

        // Get all capabilities from metadata
        const capabilities: CapabilityMetadata[] = 
          Reflect.getMetadata(CAPABILITIES_METADATA_KEY, constructor.prototype) || [];

        // Register each capability
        for (const cap of capabilities) {
          const method = (this as any)[cap.propertyKey];
          if (typeof method === 'function') {
            this._internalAgent.capability(cap.propertyKey, {
              ...cap.config,
              handler: method.bind(this),
            } as CapabilityConfig);
          }
        }

        // Get all resources from metadata
        const resources: ResourceMetadata[] =
          Reflect.getMetadata(RESOURCE_METADATA_KEY, constructor.prototype) || [];

        // Register each resource
        for (const res of resources) {
          const resourceObj = (this as any)[res.propertyKey];
          if (resourceObj && typeof resourceObj === 'object') {
            this._internalAgent.resource(res.resourceName, resourceObj as ResourceConfig);
          }
        }
      }

      /**
       * Start the agent server
       */
      async serve(options?: ServeOptions): Promise<void> {
        if (!this._internalAgent) {
          throw new Error("Agent not initialized");
        }

        const agentConfig = Reflect.getMetadata(AGENT_METADATA_KEY, constructor);
        const finalOptions = {
          ...options,
          port: options?.port ?? agentConfig.port,
        };

        return this._internalAgent.serve(finalOptions);
      }

      /**
       * Get the internal agent instance
       */
      getAgent(): IAgent {
        if (!this._internalAgent) {
          throw new Error("Agent not initialized");
        }
        return this._internalAgent;
      }

      /**
       * Handle HTTP request
       */
      async handleRequest(request: Request): Promise<Response> {
        if (!this._internalAgent) {
          throw new Error("Agent not initialized");
        }
        return this._internalAgent.handleRequest(request);
      }
    } as any;
  };
}

/**
 * @Capability decorator - marks a method as an agent capability
 * 
 * @param config - Capability configuration (optional)
 * 
 * @example
 * ```typescript
 * class MyAgent {
 *   @Capability({ 
 *     description: "Search for items",
 *     params: z.object({ query: z.string() })
 *   })
 *   async search({ query }: { query: string }) {
 *     return { results: [] };
 *   }
 * }
 * ```
 */
export function Capability(config: {
  description?: string;
  params?: ZodSchema;
  returns?: ZodSchema;
  requiresAuth?: boolean;
} = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    // Get existing capabilities or create new array
    const capabilities: CapabilityMetadata[] =
      Reflect.getMetadata(CAPABILITIES_METADATA_KEY, target) || [];

    // Add this capability
    capabilities.push({
      propertyKey,
      config,
    });

    // Store updated capabilities
    Reflect.defineMetadata(CAPABILITIES_METADATA_KEY, capabilities, target);

    return descriptor;
  };
}

/**
 * @Resource decorator - marks a property as a resource collection
 * 
 * @param name - Resource name
 * 
 * @example
 * ```typescript
 * class MyAgent {
 *   @Resource("bookings")
 *   bookings = {
 *     list: { handler: async () => ({ bookings: [] }) },
 *     get: { handler: async ({ id }) => ({ booking: {} }) },
 *   };
 * }
 * ```
 */
export function Resource(name: string) {
  return function (target: any, propertyKey: string) {
    // Get existing resources or create new array
    const resources: ResourceMetadata[] =
      Reflect.getMetadata(RESOURCE_METADATA_KEY, target) || [];

    // Add this resource
    resources.push({
      propertyKey,
      resourceName: name,
    });

    // Store updated resources
    Reflect.defineMetadata(RESOURCE_METADATA_KEY, resources, target);
  };
}

/**
 * Enable reflect-metadata polyfill if not available
 */
if (typeof Reflect === 'undefined' || !Reflect.defineMetadata) {
  throw new Error(
    'Decorators require reflect-metadata. Please install it: npm install reflect-metadata'
  );
}
