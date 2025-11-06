import { createCrawler } from "@/anp_crawler/anp_client.js";
import { Authenticator } from "@/anp_auth/authenticator.js";
import { defaultHttpClient } from "@/core/http.js";
import { DidDocumentSchema } from "@/core/did.js";
import { importSecp256k1PrivateKeyFromPem } from "@/core/crypto.js";
import { LogManager, ConsoleLogger } from "@/core/logging.js"; // <-- New import

async function main() {
  // Initialize a logger for the example, set to debug level
  const logger = new LogManager(new ConsoleLogger(), "debug"); // <-- New logger instance

  const DOC_URL = process.env.DOC_URL || "https://agent-connect.ai/mcp/agents/amap/ad.json";
  const INTERFACE_URL = process.env.INTERFACE_URL || "https://agent-connect.ai/mcp/agents/api/amap.json";
  const JSONRPC_ENDPOINT = process.env.JSONRPC_ENDPOINT || "https://agent-connect.ai/mcp/agents/tools/amap";
  const CITY1 = process.env.CITY1 || "杭州市";
  const CITY2 = process.env.CITY2 || "上海市";
  const filterMethod = (process.env.FILTER_METHOD || "").toUpperCase(); // e.g., GET
  const search = (process.env.SEARCH || "").toLowerCase(); // e.g., /profile
  const outFile = process.env.OUTPUT || ""; // e.g., examples/crawler/interface.json

  // Load local DID doc and private JWK (from examples/did_public/generate.ts)
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const base = path.resolve(process.cwd(), "examples/did_public");
  const didDocJson = await fs.readFile(path.join(base, "public-did-doc.json"), "utf8");
  const pem = await fs.readFile(path.join(base, "public-private-key.pem"), "utf8");
  const didDoc = DidDocumentSchema.parse(JSON.parse(didDocJson));
  const privateKey = importSecp256k1PrivateKeyFromPem(pem);

  // Pass the logger to Authenticator
  const authenticator = Authenticator.init({ did: didDoc.id, privateKey, logger: logger.withContext({ component: "Authenticator" }) }); // <-- Pass logger

  // Pass the logger to createCrawler
  const crawler = createCrawler({ logger: logger.withContext({ component: "Crawler" }) }); // <-- Pass logger
  const spec = await crawler.fetchInterface(INTERFACE_URL);

  // Optional write to file
  if (outFile) {
    const fs = await import("node:fs/promises");
    await fs.mkdir(require("node:path").dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, JSON.stringify(spec, null, 2));
    console.log("Saved interface to:", outFile);
  }

  const header = [
    `ID: ${spec.id}`,
    spec.version ? `Version: ${spec.version}` : undefined,
    spec.title ? `Title: ${spec.title}` : undefined,
    spec.description ? `Description: ${spec.description}` : undefined,
    `Endpoint Count: ${spec.endpoints.length}`,
  ]
    .filter(Boolean)
    .join("\n");
  console.log(header);

  // Filter and pretty print endpoints
  let endpoints = spec.endpoints;
  if (filterMethod) endpoints = endpoints.filter((e) => e.method.toUpperCase() === filterMethod);
  if (search) endpoints = endpoints.filter((e) => e.path.toLowerCase().includes(search) || e.name.toLowerCase().includes(search));

  // Group by method for readability
  const groups = new Map<string, typeof endpoints>();
  for (const ep of endpoints) {
    const key = ep.method.toUpperCase();
    const arr = groups.get(key) ?? [];
    arr.push(ep);
    groups.set(key, arr);
  }

  for (const [method, eps] of groups) {
    console.log(`\n# ${method}`);
    for (const e of eps) {
      console.log(`- ${e.name}: ${e.path}`);
    }
  }

  // --- Fetch Agent Description Document ---
  console.log("\n--- Fetching Agent Description Document ---");
  const authHeaderDoc = await authenticator.createAuthorizationHeader(DOC_URL, "GET");
  const docResp = await defaultHttpClient.request(DOC_URL, "GET", { headers: { Authorization: authHeaderDoc, Accept: "application/json" } });
  console.log("Doc status:", docResp.status);
  try {
    console.log(JSON.stringify(docResp.data, null, 2));
  } catch {
    console.log(String(docResp.data));
  }

  // --- Execute Tool via JSON-RPC (maps_weather) ---
  console.log("\n--- Executing Tool Call: maps_weather ---");
  const payload1 = { jsonrpc: "2.0", id: "demo1", method: "maps_weather", params: { city: CITY1 } };
  const authHeaderRpc1 = await authenticator.createAuthorizationHeader(JSONRPC_ENDPOINT, "POST");
  const rpc1 = await defaultHttpClient.request(JSONRPC_ENDPOINT, "POST", {
    headers: { Authorization: authHeaderRpc1, "Content-Type": "application/json", Accept: "application/json" },
    body: payload1,
  });
  console.log(JSON.stringify(rpc1.data, null, 2));

  console.log("\n--- Executing Direct JSON-RPC Call: maps_weather ---");
  const payload2 = { jsonrpc: "2.0", id: "demo2", method: "maps_weather", params: { city: CITY2 } };
  const authHeaderRpc2 = await authenticator.createAuthorizationHeader(JSONRPC_ENDPOINT, "POST");
  const rpc2 = await defaultHttpClient.request(JSONRPC_ENDPOINT, "POST", {
    headers: { Authorization: authHeaderRpc2, "Content-Type": "application/json", Accept: "application/json" },
    body: payload2,
  });
  console.log(JSON.stringify(rpc2.data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


