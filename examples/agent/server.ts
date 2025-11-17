import { createServer, serve } from "../../src/server/index.js";
import { z } from "zod";

const server = createServer({
  name: "Weather Agent",
  description: "Provides weather information",
  did: "did:wba:weather.example.com",
  baseUrl: "http://localhost:3000",
  authEnabled: false,
});

server
  .capability("getCurrentWeather", {
    description: "Get current weather for a city",
    params: z.object({
      city: z.string(),
    }),
    returns: z.object({
      city: z.string(),
      temperature: z.number(),
      condition: z.string(),
    }),
    handler: async ({ city }) => {
      return {
        city,
        temperature: 20 + Math.random() * 10,
        condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
      };
    },
  })
  .capability("getForecast", {
    description: "Get weather forecast",
    params: z.object({
      city: z.string(),
      days: z.number().min(1).max(7),
    }),
    returns: z.object({
      city: z.string(),
      forecast: z.array(
        z.object({
          date: z.string(),
          temperature: z.number(),
          condition: z.string(),
        })
      ),
    }),
    handler: async ({ city, days }) => {
      const forecast = Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000).toISOString().split("T")[0],
        temperature: 20 + Math.random() * 10,
        condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
      }));

      return {
        city,
        forecast,
      };
    },
  })
  .resource("alerts", {
    list: {
      description: "List all weather alerts",
      handler: async (params, ctx) => {
        return {
          alerts: [
            { id: "1", city: "Shanghai", type: "storm", severity: "high" },
            { id: "2", city: "Beijing", type: "fog", severity: "medium" },
          ],
        };
      },
    },
    get: {
      description: "Get a specific alert",
      params: z.object({ id: z.string() }),
      handler: async ({ id }, ctx) => {
        return {
          id,
          city: "Shanghai",
          type: "storm",
          severity: "high",
          message: "Heavy storm expected in the next 2 hours",
        };
      },
    },
  });

await serve(server, { port: 3000 });
