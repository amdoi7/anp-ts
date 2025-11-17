import { createClient, discover } from "../../src/client/index.js";

async function main() {
  console.log("=== Client Example ===\n");

  const client = createClient({
    did: "did:wba:weather.example.com",
    baseUrl: "http://localhost:3000",
  });

  console.log("1. Get Agent Description:");
  const ad = await client.getAgentDescription();
  console.log(JSON.stringify(ad, null, 2));

  console.log("\n2. Get OpenRPC:");
  const openrpc = await client.getOpenRPC();
  console.log(JSON.stringify(openrpc, null, 2));

  console.log("\n3. Call getCurrentWeather:");
  const weather = await client.call<{ city: string }, any>("getCurrentWeather", {
    city: "Shanghai",
  });
  console.log(JSON.stringify(weather, null, 2));

  console.log("\n4. Call getForecast:");
  const forecast = await client.call<{ city: string; days: number }, any>("getForecast", {
    city: "Beijing",
    days: 3,
  });
  console.log(JSON.stringify(forecast, null, 2));

  console.log("\n5. Call resource method - alerts.list:");
  const alerts = await client.call("alerts.list");
  console.log(JSON.stringify(alerts, null, 2));

  console.log("\n6. Call resource method - alerts.get:");
  const alert = await client.call<{ id: string }, any>("alerts.get", { id: "1" });
  console.log(JSON.stringify(alert, null, 2));

  console.log("\n=== Discovery Example ===\n");

  const discoveredClient = await discover("did:wba:weather.example.com");
  console.log("7. Discovered agent DID:", discoveredClient.did);
  console.log("   Base URL:", discoveredClient.baseUrl);

  const discoveredWeather = await discoveredClient.call<{ city: string }, any>(
    "getCurrentWeather",
    { city: "Guangzhou" }
  );
  console.log("8. Weather from discovered agent:");
  console.log(JSON.stringify(discoveredWeather, null, 2));
}

main().catch(console.error);
