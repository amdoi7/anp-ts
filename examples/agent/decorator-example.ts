/**
 * Example: Using Decorator API to create an Agent
 * 
 * This demonstrates the declarative decorator-based approach,
 * inspired by NestJS and FastAPI.
 */

import "reflect-metadata";
import { Agent, Capability, Resource } from "../../src/server/decorators.js";
import { z } from "zod";

// Define a simple weather service (mock)
const weatherAPI = {
  async getCurrent(city: string) {
    return {
      city,
      temperature: 22,
      condition: "Sunny",
      humidity: 60,
    };
  },

  async getForecast(city: string, days: number) {
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      temperature: 20 + Math.random() * 10,
      condition: ["Sunny", "Cloudy", "Rainy"][Math.floor(Math.random() * 3)],
    }));
  },

  async getAlerts(city: string) {
    return {
      city,
      alerts: [],
    };
  },
};

// ============================================
// Example 1: Simple Agent with Capabilities
// ============================================

@Agent({
  name: "Weather Agent",
  description: "Provides weather information",
  did: "did:wba:weather.example.com",
  port: 3000,
})
class WeatherAgent {
  @Capability({ 
    description: "Get current weather for a city",
    params: z.object({ 
      city: z.string().describe("City name") 
    }),
  })
  async getCurrentWeather({ city }: { city: string }) {
    return await weatherAPI.getCurrent(city);
  }

  @Capability({ 
    description: "Get weather forecast",
    params: z.object({ 
      city: z.string().describe("City name"),
      days: z.number().min(1).max(7).default(3).describe("Number of days")
    }),
  })
  async getForecast({ city, days }: { city: string; days: number }) {
    return await weatherAPI.getForecast(city, days);
  }

  @Capability({ 
    description: "Get weather alerts",
    params: z.object({ 
      city: z.string().describe("City name") 
    }),
  })
  async getAlerts({ city }: { city: string }) {
    return await weatherAPI.getAlerts(city);
  }
}

// ============================================
// Example 2: Agent with Resource (CRUD)
// ============================================

interface Booking {
  id: string;
  hotelId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: "pending" | "confirmed" | "cancelled";
}

// Mock database
const bookingsDB: Map<string, Booking> = new Map();

@Agent({
  name: "Hotel Booking Agent",
  description: "Manage hotel bookings",
  did: "did:wba:hotel.example.com",
  port: 3001,
})
class HotelAgent {
  @Resource("bookings")
  bookings = {
    list: {
      description: "List all bookings",
      params: z.object({
        pageSize: z.number().default(20),
        pageToken: z.string().optional(),
      }),
      handler: async ({ pageSize }: { pageSize: number; pageToken?: string }) => {
        const allBookings = Array.from(bookingsDB.values());
        return {
          bookings: allBookings.slice(0, pageSize),
          nextPageToken: allBookings.length > pageSize ? "next" : undefined,
        };
      },
    },

    get: {
      description: "Get a booking by ID",
      params: z.object({
        id: z.string(),
      }),
      handler: async ({ id }: { id: string }) => {
        const booking = bookingsDB.get(id);
        if (!booking) {
          throw new Error(`Booking ${id} not found`);
        }
        return { booking };
      },
    },

    create: {
      description: "Create a new booking",
      params: z.object({
        hotelId: z.string(),
        guestName: z.string(),
        checkIn: z.string(),
        checkOut: z.string(),
      }),
      handler: async (params: Omit<Booking, "id" | "status">) => {
        const booking: Booking = {
          id: `booking-${Date.now()}`,
          ...params,
          status: "pending",
        };
        bookingsDB.set(booking.id, booking);
        return { booking };
      },
    },

    delete: {
      description: "Cancel a booking",
      params: z.object({
        id: z.string(),
      }),
      handler: async ({ id }: { id: string }) => {
        bookingsDB.delete(id);
        return { success: true };
      },
    },

    custom: {
      confirm: {
        description: "Confirm a booking",
        params: z.object({
          id: z.string(),
        }),
        handler: async ({ id }: { id: string }) => {
          const booking = bookingsDB.get(id);
          if (!booking) {
            throw new Error(`Booking ${id} not found`);
          }
          booking.status = "confirmed";
          return { booking };
        },
      },
    },
  };

  @Capability({
    description: "Search available hotels",
    params: z.object({
      city: z.string(),
      checkIn: z.string(),
      checkOut: z.string(),
    }),
  })
  async searchHotels({ city, checkIn, checkOut }: { city: string; checkIn: string; checkOut: string }) {
    // Mock hotel search
    return {
      hotels: [
        { id: "hotel-1", name: "Grand Hotel", price: 150, available: true },
        { id: "hotel-2", name: "City Inn", price: 80, available: true },
      ],
    };
  }
}

// ============================================
// Run the agents
// ============================================

async function main() {
  console.log("🚀 Starting agents with Decorator API...\n");

  // Start Weather Agent
  const weatherAgent = new WeatherAgent();
  console.log("✅ Weather Agent created");
  console.log("   Endpoints:");
  console.log("   - POST /rpc { method: 'getCurrentWeather', params: { city: 'Beijing' } }");
  console.log("   - POST /rpc { method: 'getForecast', params: { city: 'Beijing', days: 5 } }");
  console.log("   - POST /rpc { method: 'getAlerts', params: { city: 'Beijing' } }");
  console.log("");

  // Start Hotel Agent
  const hotelAgent = new HotelAgent();
  console.log("✅ Hotel Agent created");
  console.log("   Endpoints:");
  console.log("   - POST /rpc { method: 'bookings.list', params: { pageSize: 10 } }");
  console.log("   - POST /rpc { method: 'bookings.create', params: { hotelId: '...', ... } }");
  console.log("   - POST /rpc { method: 'bookings.confirm', params: { id: '...' } }");
  console.log("   - POST /rpc { method: 'searchHotels', params: { city: 'Beijing', ... } }");
  console.log("");

  // Start servers
  console.log("Starting Weather Agent server on port 3000...");
  await weatherAgent.serve();

  // Note: Can't start both on same port in this example
  // In production, you'd run them on different ports or processes
  // await hotelAgent.serve();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { WeatherAgent, HotelAgent };
