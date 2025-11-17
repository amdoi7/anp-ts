# ANP-TS Examples

This directory contains examples demonstrating how to use the anp-ts SDK.

## Examples

### 1. Authentication (`01-auth/basic.ts`)

Demonstrates DID-WBA authentication:
- Key pair generation
- Creating authenticator
- Signing HTTP requests
- Verifying signatures

**Run:**
```bash
bun run example:auth
```

### 2. AP2 Payment (`02-ap2/cart-payment.ts`)

Demonstrates AP2 payment protocol:
- Creating cart mandates
- Creating payment mandates
- Computing cart hashes

**Run:**
```bash
bun run example:ap2
```

### 3. Interface Crawler (`crawler/fetch_interface.ts`)

Demonstrates ANP interface discovery:
- Fetching interface definitions
- Parsing endpoint information

**Run:**
```bash
bun run example:crawler
```

## Design Philosophy

All examples follow the **Fail Fast** principle:
- Errors are thrown immediately
- No defensive programming
- Clear error messages
- Simple, readable code

## Platform Compatibility

These examples work on all supported platforms:
- ✅ Node.js 18+
- ✅ Bun
- ✅ Deno
- ✅ Browser (with bundler)

## Need Help?

See the main [README.md](../README.md) for API documentation and usage guides.
