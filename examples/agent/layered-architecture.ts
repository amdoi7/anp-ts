/**
 * Example: Layered Architecture with Router System
 * 
 * Demonstrates FastANP-style layered architecture:
 * - Routers (routing layer)
 * - Services (business logic layer)
 * - Repositories (data access layer)
 * - Models (data models)
 * 
 * Structure:
 * agents/weather/
 * ├── router.ts              # Route aggregation
 * ├── routers/               # Individual routers
 * │   ├── api_router.ts      # Main API
 * │   └── ad_router.ts       # Agent Description
 * ├── services/              # Business logic
 * │   └── weather_service.ts
 * ├── repositories/          # Data access
 * │   └── weather_repository.ts
 * └── models/                # Data models
 *     └── weather.ts
 */

import { createAgent } from "../../src/server/index.js";
import { createRouter, createTaggedRouter, middleware } from "../../src/server/routing.js";
import { z } from "zod";

// ============================================
// 1. Models (Data Layer)
// ============================================

export interface Weather {
  id: string;
  city: string;
  temperature: number;
  condition: "Sunny" | "Cloudy" | "Rainy" | "Snowy";
  humidity: number;
  timestamp: Date;
}

export interface Forecast {
  day: number;
  date: string;
  temperature: number;
  condition: string;
}

// ============================================
// 2. Repository (Data Access Layer)
// ============================================

export class WeatherRepository {
  private weatherData: Map<string, Weather> = new Map();

  /**
   * Get current weather for a city
   */
  async getCurrentWeather(city: string): Promise<Weather | null> {
    // Simulate DB query
    const existing = this.weatherData.get(city.toLowerCase());
    if (existing) {
      return existing;
    }

    // Generate mock data
    const weather: Weather = {
      id: `weather-${Date.now()}`,
      city,
      temperature: 15 + Math.random() * 20,
      condition: ["Sunny", "Cloudy", "Rainy", "Snowy"][
        Math.floor(Math.random() * 4)
      ] as Weather["condition"],
      humidity: 40 + Math.random() * 40,
      timestamp: new Date(),
    };

    this.weatherData.set(city.toLowerCase(), weather);
    return weather;
  }

  /**
   * Get forecast for multiple days
   */
  async getForecast(city: string, days: number): Promise<Forecast[]> {
    // Simulate DB query
    const forecast: Forecast[] = [];
    const baseDate = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      forecast.push({
        day: i + 1,
        date: date.toISOString().split("T")[0],
        temperature: 15 + Math.random() * 20,
        condition: ["Sunny", "Cloudy", "Rainy", "Snowy"][
          Math.floor(Math.random() * 4)
        ],
      });
    }

    return forecast;
  }

  /**
   * Save weather data
   */
  async save(weather: Weather): Promise<void> {
    this.weatherData.set(weather.city.toLowerCase(), weather);
  }

  /**
   * List all cities with weather data
   */
  async listCities(): Promise<string[]> {
    return Array.from(this.weatherData.keys());
  }
}

// ============================================
// 3. Service (Business Logic Layer)
// ============================================

export class WeatherService {
  constructor(private repository: WeatherRepository) {}

  /**
   * Get current weather (with business logic)
   */
  async getCurrentWeather(city: string): Promise<Weather> {
    if (!city || city.trim() === "") {
      throw new Error("City name is required");
    }

    const weather = await this.repository.getCurrentWeather(city);
    if (!weather) {
      throw new Error(`Weather data not found for ${city}`);
    }

    return weather;
  }

  /**
   * Get forecast with validation
   */
  async getForecast(city: string, days: number): Promise<Forecast[]> {
    if (days < 1 || days > 7) {
      throw new Error("Days must be between 1 and 7");
    }

    return await this.repository.getForecast(city, days);
  }

  /**
   * Get weather alerts (business logic)
   */
  async getAlerts(city: string): Promise<{ city: string; alerts: string[] }> {
    const weather = await this.getCurrentWeather(city);
    const alerts: string[] = [];

    // Business logic for alerts
    if (weather.temperature > 35) {
      alerts.push("High temperature warning");
    }
    if (weather.condition === "Rainy" && weather.humidity > 80) {
      alerts.push("Heavy rain expected");
    }
    if (weather.condition === "Snowy") {
      alerts.push("Snow storm warning");
    }

    return { city, alerts };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalCities: number;
    avgTemperature: number;
  }> {
    const cities = await this.repository.listCities();
    const weatherData = await Promise.all(
      cities.map((city) => this.repository.getCurrentWeather(city))
    );

    const avgTemp =
      weatherData.reduce((sum, w) => sum + (w?.temperature || 0), 0) /
      (weatherData.length || 1);

    return {
      totalCities: cities.length,
      avgTemperature: Math.round(avgTemp * 10) / 10,
    };
  }
}

// ============================================
// 4. Routers (Routing Layer)
// ============================================

/**
 * API Router - Main weather API endpoints
 * 
 * Convention: agents/weather/routers/api_router.ts
 * Auto-generated tag: "Weather API"
 */
function createAPIRouter(service: WeatherService) {
  const router = createRouter({
    prefix: "weather",
    tags: ["Weather API"],
    service,
  });

  // Add logging middleware
  router.use(middleware.logging());

  // Add rate limiting
  router.use(middleware.rateLimit({ requests: 100, windowMs: 60000 }));

  // Register capabilities
  router.capability("getCurrentWeather", {
    description: "Get current weather for a city",
    params: z.object({
      city: z.string().describe("City name"),
    }),
    handler: async ({ city }, ctx) => {
      return await ctx.service.getCurrentWeather(city);
    },
  });

  router.capability("getForecast", {
    description: "Get weather forecast",
    params: z.object({
      city: z.string().describe("City name"),
      days: z.number().min(1).max(7).default(3).describe("Number of days"),
    }),
    handler: async ({ city, days }, ctx) => {
      return await ctx.service.getForecast(city, days);
    },
  });

  router.capability("getAlerts", {
    description: "Get weather alerts",
    params: z.object({
      city: z.string().describe("City name"),
    }),
    handler: async ({ city }, ctx) => {
      return await ctx.service.getAlerts(city);
    },
  });

  router.capability("getStats", {
    description: "Get weather statistics",
    handler: async (params, ctx) => {
      return await ctx.service.getStats();
    },
  });

  return router;
}

/**
 * Admin Router - Administrative endpoints
 */
function createAdminRouter(service: WeatherService) {
  const router = createRouter({
    prefix: "weather.admin",
    tags: ["Weather Admin"],
    service,
  });

  // Require authentication for admin
  router.use(middleware.requireAuth());
  router.use(middleware.logging());

  router.capability("clearCache", {
    description: "Clear weather cache",
    requiresAuth: true,
    handler: async () => {
      // Admin logic here
      return { success: true, message: "Cache cleared" };
    },
  });

  return router;
}

// ============================================
// 5. Agent Setup (Aggregation)
// ============================================

async function main() {
  console.log("🚀 Starting Weather Agent with Layered Architecture...\n");

  // Initialize layers
  const repository = new WeatherRepository();
  const service = new WeatherService(repository);

  // Create agent
  const agent = createAgent({
    name: "Weather Agent",
    description: "Provides weather information with layered architecture",
    did: "did:wba:weather.example.com",
    authEnabled: false,
  });

  // Register routers
  const apiRouter = createAPIRouter(service);
  const adminRouter = createAdminRouter(service);

  agent.useRouter(apiRouter);
  agent.useRouter(adminRouter);

  console.log("✅ Agent created with layers:");
  console.log("   - Repository (data access)");
  console.log("   - Service (business logic)");
  console.log("   - Routers (API endpoints)");
  console.log("");

  console.log("📋 Available endpoints:");
  console.log("   Public API:");
  console.log("   - POST /rpc { method: 'weather.getCurrentWeather', params: { city: 'Beijing' } }");
  console.log("   - POST /rpc { method: 'weather.getForecast', params: { city: 'Beijing', days: 5 } }");
  console.log("   - POST /rpc { method: 'weather.getAlerts', params: { city: 'Beijing' } }");
  console.log("   - POST /rpc { method: 'weather.getStats', params: {} }");
  console.log("");
  console.log("   Admin API (requires auth):");
  console.log("   - POST /rpc { method: 'weather.admin.clearCache', params: {} }");
  console.log("");

  console.log("🔧 Features:");
  console.log("   ✓ Layered architecture (repository → service → router)");
  console.log("   ✓ Dependency injection (service injected into router)");
  console.log("   ✓ Middleware support (logging, rate limiting, auth)");
  console.log("   ✓ Auto-tagging for documentation");
  console.log("   ✓ Type-safe context with service access");
  console.log("");

  // Start server
  console.log("Starting server on port 3000...");
  await agent.serve({ port: 3000 });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  WeatherRepository,
  WeatherService,
  createAPIRouter,
  createAdminRouter,
};
