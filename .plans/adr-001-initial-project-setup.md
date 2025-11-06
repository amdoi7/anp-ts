# ADR-001: Initial Project Setup and Technology Choices

*   **Status**: Proposed
*   **Context**: We are migrating the `anp-go` project to a modern TypeScript implementation named `anp-ts`. We need to establish the foundational technology stack and project structure to ensure a robust, maintainable, and secure library.
*   **Decision**:
    1.  **Language**: Use **TypeScript** (latest stable version) to provide strong typing and catch errors early.
    2.  **Environment & Runtime**: Use **Bun** as the JavaScript runtime, package manager, and test runner. This replaces Node.js, npm, and Jest.
    3.  **Module System**: Use **ECMAScript Modules (ESM)** (`import`/`export`) for modern, standard-compliant code. Bun natively supports ESM.
    4.  **Testing Framework**: Use **Bun's built-in test runner** (`bun test`).
    5.  **Cryptography**:
        *   For JWT, JWS, and JWK operations, use the **`jose`** library. It is a modern, zero-dependency, and widely-trusted library for JOSE standards.
        *   For `secp256k1` elliptic curve operations (key generation, signing, verification), use the **`@noble/curves`** library. It is audited, secure, and designed with a focus on correctness.
    6.  **JSON Canonicalization**: Use the **`canonicalize`** library to ensure consistent JSON output for signing, matching the JCS (RFC 8785) standard.
    7.  **Development Process**: Adhere to **Test-Driven Development (TDD)**. All new functionality must be accompanied by tests.
*   **Consequences**:
    *   **Easier**:
        *   Significantly faster development cycles due to Bun's speed (installation, testing, runtime).
        *   Simplified toolchain (Bun handles runtime, package management, testing, and TypeScript compilation).
        *   Onboarding for developers familiar with Bun.
        *   Maintaining code quality through static analysis and comprehensive testing.
        *   Integration with other JavaScript/TypeScript projects.
    *   **Harder**:
        *   Bun is a newer technology; potential for encountering edge cases or less mature ecosystem support compared to Node.js/npm.
        *   Direct reuse of Go-specific libraries or concurrency patterns (like `singleflight`) will require finding or creating TypeScript equivalents.
*   **Implementation**: The project has been initialized with `npm`, but will be migrated to `bun`. Dependencies will be managed by `bun`. Configuration for TypeScript (`tsconfig.json`) will be adapted for Bun, and `jest.config.js` will be removed as Bun's test runner will be used.
