/**
 * Example: Fetch ANP Interface
 * 
 * Simple example showing how to fetch and parse ANP interface definitions.
 * Uses the new simplified API.
 * 
 * Run: bun run example:crawler
 */

import { createCrawler } from "../../src/crawler/index.js";

async function main() {
  console.log("=".repeat(60));
  console.log("  ANP Interface Crawler");
  console.log("=".repeat(60));
  console.log();

  // Create crawler with new simplified API
  const crawler = createCrawler({
    timeout: 10000 // 10 seconds
  });

  // Example URL - can be overridden with env variable
  const url = process.env.INTERFACE_URL || "https://agent-weather.xyz/.well-known/anp-interface.json";
  
  console.log(`Fetching interface from: ${url}`);
  console.log();

  try {
    // Fetch interface (Fail Fast - throws if fails)
    const anpInterface = await crawler.fetch(url);

    console.log("✅ Interface fetched successfully!");
    console.log();
    console.log("Agent Name:", anpInterface.name || "N/A");
    console.log("Description:", anpInterface.description || "N/A");
    console.log("Endpoints:", anpInterface.endpoints?.length || 0);
    console.log();

    if (anpInterface.endpoints && anpInterface.endpoints.length > 0) {
      console.log("Available endpoints:");
      anpInterface.endpoints.forEach((endpoint, index) => {
        console.log(`  ${index + 1}. ${endpoint.method} ${endpoint.path}`);
        if (endpoint.description) {
          console.log(`     ${endpoint.description}`);
        }
      });
    }

    // Optional: save to file
    const outFile = process.env.OUTPUT;
    if (outFile) {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.writeFile(outFile, JSON.stringify(anpInterface, null, 2));
      console.log();
      console.log(`💾 Saved interface to: ${outFile}`);
    }

    console.log();
    console.log("✨ Done!");
  } catch (error) {
    console.error();
    console.error("❌ Error fetching interface:");
    console.error(`   ${(error as Error).message}`);
    console.log();
    console.log("💡 Tips:");
    console.log("   - Make sure the URL is a valid ANP interface endpoint");
    console.log("   - Check your network connection");
    console.log("   - Try with: INTERFACE_URL=https://example.com/.well-known/anp-interface.json bun run example:crawler");
    process.exit(1);
  }
}

main().catch(console.error);
