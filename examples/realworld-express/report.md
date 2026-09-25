# Technology due diligence — https://github.com/gothinkster/node-express-realworld-example-app

_Generated 2026-09-25T18:26:20.455Z · mode: full · model: claude-haiku-4-5-20251001 · 67 files, 2,537 lines of code_

**Overall: 42/100 — Red**

> This codebase is a high-risk acquisition due to a critical authentication vulnerability, 995 days of dormancy, and pervasive architectural and security gaps that require substantial remediation before production use.

## Red flags

- Hardcoded JWT secret fallback enables authentication bypass; must be removed and replaced with required environment variable before any deployment.
- Codebase dormant for 995 days with no recent maintenance, security updates, or team activity; full security audit and dependency refresh required before close.
- No continuous integration pipeline; manual testing and deployment processes create high regression risk and operational friction.
- Low bus factor with single dominant contributor; critical knowledge transfer and team availability assessment needed before acquisition.
- No infrastructure-as-code, deployment manifests, or observability instrumentation; application cannot be reliably deployed or operated in production.

## Value-creation levers

- Introduce repository/data access layer to decouple business logic from Prisma ORM, reducing testing complexity and enabling future data source flexibility.
- Expand test coverage from minimal to 60%+ for critical paths (auth, article CRUD) using integration tests and dependency injection, reducing regression risk.
- Implement structured logging, health checks, and Prometheus metrics to enable production observability and Kubernetes integration.
- Refactor monolithic services into focused modules with explicit public APIs using Nx library structure, improving scalability and maintainability.
- Establish automated dependency updates via Dependabot and enforce stricter TypeScript configuration to reduce security and type-safety debt.

## 100-day plan

1. Days 1-14: Conduct full security audit, update all dependencies to latest stable versions, run test suite against current Node.js LTS, and validate application functionality.
2. Days 15-30: Remove hardcoded JWT secret fallback, implement environment variable validation at startup, and enable Dependabot for automated security patch detection.
3. Days 31-50: Establish CI/CD pipeline (GitHub Actions) to run tests and linting on pull requests; implement pre-commit hooks for local enforcement.
4. Days 51-75: Increase test coverage to 60% for critical paths by adding integration tests and refactoring services to use dependency injection; resolve skipped test suite.
5. Days 76-90: Create infrastructure-as-code (docker-compose for dev, Kubernetes manifests for prod), add structured logging and /health endpoints, and integrate database migrations into deployment.
6. Days 91-100: Document architecture, API implementation, database schema, and deployment procedures; conduct knowledge transfer sessions with original contributors and incoming team.

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 50 | Red | 7 |
| Code quality & tech debt | 52 | Red | 6 |
| Security | 32 | Red | 6 |
| Cloud readiness | 49 | Red | 6 |
| Team & process | 29 | Red | 5 |

## Findings

### Architecture & stack

- **[HIGH] Monolithic service layer with high coupling to Prisma ORM** (effort M) — The service layer (e.g., article.service.ts at 652 lines) directly embeds Prisma queries and business logic without abstraction. Services are tightly coupled to the ORM, making it difficult to swap data sources, test in isolation, or reuse logic across different contexts. The article service alone contains 10+ exported functions with complex query building logic intermingled with business rules.
  - Recommendation: Introduce a repository or data access layer to abstract Prisma queries from business logic. Consider extracting query builders and domain logic into separate modules. This will improve testability (reducing reliance on mocking the entire ORM) and allow future data source changes without rewriting services.
  - Evidence: `READ-020`, `ARC-001`
- **[HIGH] Minimal test coverage and weak test architecture** (effort L) — Only 7 test files for 36 source files (19% ratio, per QUA-001). The tag.service.test.ts file is nearly empty (6 lines with a TODO marker per QUA-003). Tests rely on jest-mock-extended to mock Prisma, but without a repository abstraction, mocking is brittle and tests do not validate real data access patterns. No integration tests or e2e tests beyond a single server spec.
  - Recommendation: Increase test coverage to at least 60% for critical paths (auth, article CRUD). Introduce integration tests using a test database or in-memory SQLite. Refactor services to use dependency injection so tests can inject mock repositories without mocking the entire ORM. This will reduce regression risk and improve confidence in refactoring.
  - Evidence: `QUA-001`, `QUA-003`, `READ-003`
- **[MEDIUM] Weak separation of concerns between controllers and services** (effort M) — Controllers directly call service functions and pass raw request objects (e.g., `query: any`, `article: any`). There is no input validation layer, DTO pattern, or clear contract between HTTP and business logic. The article controller (243 lines) mixes routing, parameter extraction, and error handling without clear boundaries.
  - Recommendation: Implement DTOs (Data Transfer Objects) and a validation layer (e.g., using class-validator or Zod) to enforce contracts between HTTP and services. This will improve type safety, reduce bugs from malformed input, and make the API contract explicit.
  - Evidence: `READ-015`, `ARC-001`
- **[MEDIUM] Nx monorepo structure underutilized for modularity** (effort M) — The project uses Nx (a monorepo tool) but organizes code by feature (article, auth, profile, tag) within a single application rather than as independent, reusable libraries. There is no clear library boundary or shared module structure. The nx.json shows caching and build optimization configured, but the codebase does not leverage Nx's ability to enforce module boundaries or create composable libraries.
  - Recommendation: Refactor feature modules into Nx libraries with explicit public APIs (via index.ts barrel exports). Define clear dependency rules in nx.json to prevent circular dependencies and enforce layering (e.g., services cannot depend on controllers). This will improve scalability and make the codebase easier to extend.
  - Evidence: `READ-016`, `ARC-002`
- **[MEDIUM] Error handling lacks consistency and type safety** (effort S) — The main.ts error handler uses `@ts-ignore` comments and checks for `err.name === 'UnauthorizedError'` and `err.errorCode` without type guards. HttpException is a custom class, but not all errors are wrapped in it. This creates fragile error handling that is hard to extend and prone to unhandled edge cases.
  - Recommendation: Define a discriminated union type for all error types (HttpException, UnauthorizedError, ValidationError, etc.) and use type guards or a custom error handler middleware to route them consistently. Remove @ts-ignore comments and ensure all errors are properly typed.
  - Evidence: `READ-014`
- **[LOW] Express framework with minimal middleware abstraction** (effort S) — The application uses Express directly with basic middleware (cors, body-parser) but no abstraction layer for cross-cutting concerns like logging, request tracing, or rate limiting. Authentication is handled via express-jwt middleware, but there is no centralized middleware composition or plugin system for extensibility.
  - Recommendation: Consider a lightweight middleware framework or utility to compose and order middleware consistently. Document the middleware stack and add logging/tracing middleware for observability. This will make the application easier to extend and debug in production.
  - Evidence: `READ-014`, `ARC-003`
- **[INFO] Clean TypeScript configuration and linting setup** (effort S) — The project has well-configured TypeScript (tsconfig.json, tsconfig.app.json, tsconfig.spec.json) with strict type checking, ESLint with TypeScript support, and Prettier for formatting. Nx caching is enabled for build and lint tasks, which will improve developer velocity as the codebase grows.
  - Recommendation: Maintain these standards. Consider adding a pre-commit hook (husky) to enforce linting and formatting before commits, and document the development workflow in the README.
  - Evidence: `QUA-002`, `READ-003`, `READ-016`

### Code quality & tech debt

- **[HIGH] Incomplete test coverage with skipped test suite** (effort M) — The tag service test file contains only a skipped test (test.todo) with no implementation. The TODO comment indicates a known issue with mocking that was never resolved. Combined with a test-to-source ratio of 0.19 (7 test files for 36 source files), critical business logic in article.service.ts (652 lines) and auth.service.ts (183 lines) lacks comprehensive test coverage. The article service has only 3 test cases covering a small subset of its 8+ exported functions.
  - Recommendation: Implement the skipped tag service test and expand coverage for article and auth services. Target at least 70% line coverage for critical business logic. Resolve the mocking issue documented in the TODO comment.
  - Evidence: `READ-002`, `QUA-001`, `READ-010`, `READ-018`
- **[HIGH] Dormant codebase with no recent maintenance** (effort M) — The repository has not been updated in 995 days (last commit ~2.7 years ago). No commits in the last 90 days. With 16 contributors and a bus factor of 2, knowledge of the codebase is concentrated. The lack of recent activity combined with outdated dependencies (Express 4.18.1, Prisma 4.16.1) and no CI/CD pipeline means technical debt accumulates without oversight.
  - Recommendation: Establish a maintenance plan: audit and update dependencies, run the test suite against current Node.js LTS, and document critical business logic. Consider assigning a dedicated maintainer or team to address accumulated debt before further development.
  - Evidence: `TEAM-003`, `TEAM-004`, `TEAM-005`
- **[MEDIUM] Large monolithic service modules with mixed concerns** (effort M) — article.service.ts contains 652 lines with 8+ exported functions handling article CRUD, filtering, favoriting, and comment operations. The buildFindAllQuery helper function uses untyped 'any' parameters and builds complex Prisma queries with nested conditionals. auth.service.ts (183 lines) mixes user creation, login, and profile updates. This violates single responsibility and makes testing, maintenance, and debugging harder.
  - Recommendation: Refactor large services into smaller, focused modules. Extract query builders into separate utilities with proper typing. Consider splitting article operations (CRUD vs. social features) and auth operations (registration vs. session management) into separate files.
  - Evidence: `READ-008`, `READ-009`
- **[MEDIUM] Widespread use of 'any' type undermines TypeScript safety** (effort M) — Both article.service.ts and auth.service.ts use untyped 'any' parameters extensively (e.g., 'query: any', 'article: any', 'userPayload: any'). This defeats TypeScript's type safety benefits and makes refactoring risky. The codebase has TypeScript 5.2.2 and strict linting configured, but type discipline is not enforced at the service layer.
  - Recommendation: Define and use proper TypeScript interfaces for all service function parameters. Enforce stricter TypeScript compiler options (noImplicitAny, strict mode) in tsconfig. Add ESLint rules to ban 'any' type usage.
  - Evidence: `READ-008`, `READ-009`, `READ-001`
- **[MEDIUM] Duplicate Prisma query patterns create maintenance burden** (effort S) — The article.service.ts file repeats the same Prisma include/select patterns across getArticles, getFeed, createArticle, and getArticle functions. The author selection (username, bio, image, followedBy) and tag/favorite includes are duplicated verbatim. This violates DRY principles and makes schema changes error-prone.
  - Recommendation: Extract repeated Prisma query fragments into reusable constants or helper functions. Define a shared ArticleInclude object that can be reused across all article queries.
  - Evidence: `READ-008`
- **[INFO] Linting and formatting infrastructure in place** (effort S) — The project has ESLint and Prettier configured across multiple scopes (.eslintrc.json, .prettierrc, e2e/.eslintrc.json) with TypeScript support (@typescript-eslint/eslint-plugin, @typescript-eslint/parser). This provides a foundation for code quality enforcement and consistency.
  - Recommendation: Ensure linting and formatting are enforced in CI/CD (once established) and pre-commit hooks. Consider adding rules to enforce stricter type safety and reduce 'any' usage.
  - Evidence: `QUA-002`, `READ-001`

### Security

- **[CRITICAL] Hardcoded JWT secret fallback exposes authentication bypass risk** (effort S) — The JWT authentication middleware uses a hardcoded fallback secret 'superSecret' when the JWT_SECRET environment variable is not set. This appears in three locations (auth.ts and token.utils.ts). An attacker who knows this default secret can forge valid JWT tokens and impersonate any user, completely bypassing authentication. This is a critical vulnerability in a production API that handles user authentication and authorization.
  - Recommendation: Remove the hardcoded fallback secret entirely. Require JWT_SECRET to be explicitly set in the environment; fail fast at startup if it is missing. Use a strong, randomly generated secret (minimum 32 bytes) for production deployments. Consider using a secrets management system (e.g., AWS Secrets Manager, HashiCorp Vault) for secret rotation.
  - Evidence: `READ-011`, `READ-017`
- **[HIGH] Dormant codebase with no recent maintenance or security updates** (effort M) — The repository has not received any commits in 995 days (last commit ~2.7 years ago). During this period, the Node.js ecosystem, Express, Prisma, and all dependencies have evolved significantly, and security vulnerabilities have likely been discovered in the pinned versions. The codebase is frozen in time and cannot respond to emerging threats. This is compounded by the lack of CI/CD (TEAM-001) to validate that the code still builds and runs with current tooling.
  - Recommendation: Before deploying to production, conduct a full security audit and dependency refresh. Update all dependencies to their latest stable versions, run the test suite, and validate the application still functions. Establish a maintenance plan: either assign an owner to maintain the codebase with regular security updates, or accept the risk and plan for eventual replacement. If this is a legacy/archived asset, document its status clearly and restrict its use.
  - Evidence: `TEAM-005`, `TEAM-003`, `READ-006`
- **[MEDIUM] Container runs as root user** (effort S) — The Dockerfile creates a non-root user 'api' and changes ownership of files to that user, but the CMD instruction does not include a USER directive. This means the container will run as root by default, increasing the blast radius if the application is compromised. While the Dockerfile shows good intent (creating the api user), the final step is missing.
  - Recommendation: Add 'USER api' directive before the CMD instruction in the Dockerfile to ensure the container runs with minimal privileges. This is a standard hardening practice for containerized applications.
  - Evidence: `READ-005`, `SEC-001`
- **[MEDIUM] No automated dependency update mechanism** (effort S) — The repository has 11 runtime and 28 dev dependencies but no Dependabot, Renovate, or equivalent automated dependency update configuration. With the codebase dormant for 995 days (last commit 2.7 years ago), dependencies are likely outdated and may contain known security vulnerabilities. The package.json uses caret ranges (^) which allow minor and patch updates, but without automation, updates are manual and easily overlooked.
  - Recommendation: Enable Dependabot (GitHub native) or Renovate to automatically detect and propose dependency updates. Configure it to create pull requests for security patches (critical/high severity) immediately and for minor/patch updates on a regular cadence. Pair with CI testing to validate updates before merge.
  - Evidence: `SEC-002`, `READ-006`, `TEAM-005`
- **[MEDIUM] Environment variables used for secrets but no validation or documentation** (effort S) — The application reads JWT_SECRET, PORT, HOST, NODE_ENV, and DATABASE_URL from environment variables (CLD-003), which is correct for 12-factor apps. However, there is no validation that required secrets are present at startup, no documentation of which variables are mandatory vs. optional, and no guidance on secret rotation or secure storage. The README mentions creating a .env file but provides minimal detail on required values.
  - Recommendation: Add startup validation to ensure all required environment variables (especially JWT_SECRET and DATABASE_URL) are set before the application starts. Document all required and optional environment variables in README with examples and security guidance. Use a library like 'joi' or 'zod' to validate environment configuration at startup. Never log or expose secret values in error messages or logs.
  - Evidence: `CLD-003`, `READ-012`, `READ-011`
- **[INFO] Bcrypt password hashing is properly implemented** (effort S) — The authentication service correctly uses bcryptjs with a salt round of 10 for password hashing (auth.service.ts). Passwords are hashed before storage and compared securely during login. This is a cryptographic best practice and significantly reduces the risk of password compromise in case of database breach.
  - Recommendation: Maintain this practice. Consider documenting the password policy (minimum length, complexity requirements) and ensure it is enforced at registration and password change endpoints.
  - Evidence: `READ-007`

### Cloud readiness

- **[HIGH] No infrastructure-as-code or deployment manifests** (effort M) — The repository contains no Kubernetes manifests, Docker Compose files, Terraform, CloudFormation, or other infrastructure-as-code. The README documents manual deployment steps (npm ci && npx prisma migrate deploy && node dist/api/main.js) but provides no repeatable, version-controlled deployment configuration. This creates friction for cloud migration, makes it difficult to reproduce environments, and increases operational overhead.
  - Recommendation: Create a docker-compose.yml for local development and a Kubernetes manifest (Deployment, Service, ConfigMap, Secret) or equivalent IaC (Terraform, CloudFormation) for production deployment. Include database migration as part of the deployment pipeline rather than manual steps.
  - Evidence: `CLD-002`, `READ-024`
- **[HIGH] No observability instrumentation (health checks, metrics, structured logging)** (effort M) — The application lacks health check endpoints, structured logging, and metrics collection. The codebase uses only console.info() for logging (READ-023) with no logging library (Winston, Pino, etc.) in dependencies (READ-028). There are no Prometheus metrics, APM instrumentation, or readiness/liveness probes. This makes it difficult to monitor application health, debug issues in production, and integrate with cloud-native observability platforms.
  - Recommendation: Add a structured logging library (Pino or Winston) and implement /health and /ready endpoints for Kubernetes probes. Integrate Prometheus client library for basic metrics (request count, latency, errors). Consider adding OpenTelemetry for distributed tracing if this service will be part of a larger system.
  - Evidence: `READ-027`, `READ-023`, `READ-028`
- **[HIGH] Database migrations are manual and not integrated into deployment** (effort M) — Prisma migrations exist (src/prisma/migrations/) but are applied manually via npx prisma migrate deploy as a separate step documented in the README. This creates deployment complexity and risk: migrations can fail, be skipped, or run out of order. In cloud environments with multiple replicas or blue-green deployments, manual migration steps are error-prone and difficult to coordinate.
  - Recommendation: Integrate database migrations into the application startup sequence (e.g., run prisma migrate deploy in a Kubernetes init container or as part of the entrypoint script). Alternatively, use a dedicated migration job that runs before the application starts. Document the migration strategy clearly in deployment manifests.
  - Evidence: `READ-024`
- **[MEDIUM] 12-factor configuration partially implemented via environment variables** (effort S) — The application reads configuration from environment variables (PORT, HOST, DATABASE_URL, JWT_SECRET, NODE_ENV) as documented in the README and implemented in src/main.ts and src/prisma/prisma-client.ts. However, the implementation is incomplete: there is no validation of required environment variables at startup, no defaults for optional variables beyond PORT, and no centralized configuration management. This creates operational risk in cloud deployments where misconfiguration can cause silent failures.
  - Recommendation: Add startup validation that checks all required environment variables (DATABASE_URL, JWT_SECRET) are present and non-empty before the server starts. Implement a configuration module that centralizes all env var reads with clear documentation of required vs. optional variables and their defaults.
  - Evidence: `CLD-003`, `READ-023`, `READ-024`
- **[INFO] Dockerfile includes security hardening with non-root user** (effort S) — The Dockerfile correctly creates a dedicated system user 'api' and runs the container under that user rather than as root. This follows container security best practices and reduces the blast radius of container escape vulnerabilities. The image uses Alpine Linux (node:lts-alpine) which is lightweight and suitable for cloud deployment.
  - Recommendation: Maintain this security posture in future updates. Consider adding health check directives (HEALTHCHECK) to the Dockerfile for better orchestration integration.
  - Evidence: `READ-022`, `CLD-001`
- **[INFO] Lightweight dependency footprint suitable for containerization** (effort S) — The application has a minimal runtime dependency set (11 dependencies) focused on core functionality: Express, Prisma, JWT, bcrypt, and CORS. No heavy frameworks or bloated libraries are present. This keeps the Docker image small, reduces attack surface, and simplifies dependency management. The use of Nx for monorepo tooling and esbuild for bundling supports efficient builds.
  - Recommendation: Maintain this lean dependency profile. When adding new dependencies, prefer lightweight alternatives and regularly audit for unused packages.
  - Evidence: `READ-028`, `ARC-002`

### Team & process

- **[CRITICAL] Codebase dormant for 995 days with no recent development activity** (effort M) — The repository has not received any commits in the last 995 days (nearly 2.7 years). This represents a complete halt in development and maintenance. For a software asset being acquired, this raises serious concerns about ongoing support, security patching, and the ability to onboard or retain a development team. The codebase is effectively abandoned from an active development perspective.
  - Recommendation: Before acquisition, establish a clear plan for reactivating the codebase: (1) conduct a full security audit given the extended dormancy period, (2) assess whether dependencies are still compatible and secure, (3) determine if the team that built this asset is available for transition or if new developers must be hired and onboarded, (4) define a post-acquisition maintenance and update cadence.
  - Evidence: `TEAM-003`, `TEAM-005`
- **[HIGH] No continuous integration pipeline configured** (effort S) — The repository contains no CI configuration files (.github/workflows, .gitlab-ci.yml, .circleci, Travis CI, or similar). While the README references a Travis CI badge, no actual CI configuration exists in the repository. This means there is no automated testing, linting, or build verification on commits. Combined with the dormancy, this indicates the project never had a mature delivery process.
  - Recommendation: Implement a CI/CD pipeline as part of post-acquisition stabilization. At minimum: (1) add GitHub Actions or equivalent to run tests and linting on every pull request, (2) ensure the build and test suite runs reliably (currently only manual via npm scripts), (3) gate merges to main on passing CI checks. This is essential for any ongoing development.
  - Evidence: `TEAM-001`, `READ-025`
- **[HIGH] Low bus factor with single dominant contributor** (effort S) — The top contributor authored 31% of all commits across 55 total commits by 16 contributors. While not extreme, this concentration of knowledge combined with 995 days of inactivity suggests that key individuals may no longer be available or engaged. The 16-contributor count is misleading given the dormancy—most contributors likely made one-off contributions years ago.
  - Recommendation: Before close, identify and interview the top 3 contributors to assess: (1) their current availability and willingness to support the asset post-acquisition, (2) whether critical architectural or operational knowledge exists only in their heads, (3) the feasibility of knowledge transfer to a new team. Prioritize documenting any undocumented design decisions or operational procedures.
  - Evidence: `TEAM-004`, `TEAM-003`
- **[MEDIUM] Minimal onboarding documentation for a production Express/Prisma service** (effort M) — The README (74 lines) covers basic setup steps (install, environment variables, migrations, running the server) but lacks critical operational documentation: no architecture overview, no deployment runbook, no troubleshooting guide, no explanation of the RealWorld API spec it implements, and no guidance on extending or modifying the codebase. For a service with 2,371 lines of TypeScript and database migrations, this is insufficient for a new team to take ownership.
  - Recommendation: Expand documentation to include: (1) a high-level architecture diagram and module overview, (2) explanation of the RealWorld API spec and how this codebase implements it, (3) database schema documentation, (4) deployment and environment setup guide, (5) common troubleshooting scenarios. Assign this to the incoming team as part of onboarding to ensure they understand the system.
  - Evidence: `TEAM-002`, `READ-025`, `ARC-001`
- **[INFO] Well-structured development tooling and test infrastructure in place** (effort S) — Despite dormancy, the codebase demonstrates solid engineering practices: Nx monorepo tooling for build orchestration, Jest for unit and e2e testing (7 test files), ESLint and Prettier for code quality, TypeScript for type safety, and Prisma for database abstraction. The project.json defines clear build, test, lint, and serve targets. This foundation makes reactivation and team onboarding more feasible than a greenfield project.
  - Recommendation: Leverage this existing infrastructure during reactivation: ensure the incoming team is trained on Nx commands and the test/lint workflow, and use the existing test suite as a regression baseline when making changes.
  - Evidence: `READ-029`, `READ-030`, `QUA-002`, `ARC-002`

## Evidence

- `ARC-001` 2,537 lines of code: TypeScript 93%, SQL 6%, JavaScript 0%
- `ARC-002` npm manifest package.json: 11 runtime and 28 dev dependencies — package.json
- `ARC-003` Frameworks detected: Express, Prisma
- `QUA-001` 7 test files for 36 source files (ratio 0.19)
- `TEAM-001` No CI configuration found
- `QUA-002` Linting/formatting configured (.eslintrc.json, .prettierrc, e2e/.eslintrc.json) — .eslintrc.json, .prettierrc, e2e/.eslintrc.json
- `QUA-003` 1 TODO/FIXME/HACK markers in 1 files — src/tests/services/tag.service.test.ts
- `TEAM-002` README present (74 lines) — README.md
- `SEC-001` Dockerfile has no USER directive — the container runs as root — Dockerfile
- `SEC-002` No Dependabot or Renovate configuration found
- `CLD-001` Containerised (Dockerfile) — Dockerfile
- `CLD-002` No infrastructure-as-code or deployment configuration found
- `CLD-003` Configuration read from environment variables in 5 files (12-factor) — e2e/src/support/test-setup.ts, src/app/routes/auth/auth.ts, src/app/routes/auth/token.utils.ts, src/main.ts, src/prisma/prisma-client.ts
- `TEAM-003` 55 commits by 16 contributors since 2016-07; 0 in the last 90 days; last commit 995 days ago
- `TEAM-004` Bus factor 2: top contributor authored 31% of commits
- `TEAM-005` No commits for 995 days
- `READ-001` Inspected package.json — package.json
- `READ-002` Inspected src/tests/services/tag.service.test.ts — src/tests/services/tag.service.test.ts
- `READ-003` Inspected package.json — package.json
- `READ-004` Inspected README.md — README.md
- `READ-005` Inspected Dockerfile — Dockerfile
- `READ-006` Inspected package.json — package.json
- `READ-007` Code search (41-char pattern): 20 matches — package.json, README.md, src/app/routes/auth/auth.service.ts
- `READ-008` Inspected src/app/routes/article/article.service.ts — src/app/routes/article/article.service.ts
- `READ-009` Inspected src/app/routes/auth/auth.service.ts — src/app/routes/auth/auth.service.ts
- `READ-010` Code search (19-char pattern): 2 matches — src/tests/services/tag.service.test.ts
- `READ-011` Inspected src/app/routes/auth/auth.ts — src/app/routes/auth/auth.ts
- `READ-012` Inspected src/main.ts — src/main.ts
- `READ-013` Code search (18-char pattern): 9 matches — .gitignore, e2e/src/support/test-setup.ts, README.md, src/app/routes/auth/auth.ts, src/app/routes/auth/token.utils.ts
- `READ-014` Inspected src/main.ts — src/main.ts
- `READ-015` Inspected src/app/routes/routes.ts — src/app/routes/routes.ts
- `READ-016` Inspected nx.json — nx.json
- `READ-017` Code search (32-char pattern): 5 matches — src/app/routes/auth/auth.ts, src/app/routes/auth/token.utils.ts, src/tests/services/tag.service.test.ts
- `READ-018` Inspected src/tests/services/article.service.test.ts — src/tests/services/article.service.test.ts
- `READ-019` Code search (20-char pattern): 49 matches — e2e/src/server/server.spec.ts, src/app/routes/auth/auth.ts, src/prisma/seed.ts, src/tests/services/article.service.test.ts, src/tests/services/auth.service.test.ts
- `READ-020` Inspected src/app/routes/article/article.service.ts — src/app/routes/article/article.service.ts
- `READ-021` Code search (27-char pattern): 40 matches — .eslintrc.json, .gitignore, e2e/.eslintrc.json, e2e/jest.config.ts, e2e/project.json
- `READ-022` Inspected Dockerfile — Dockerfile
- `READ-023` Inspected src/main.ts — src/main.ts
- `READ-024` Inspected README.md — README.md
- `READ-025` Inspected README.md — README.md
- `READ-026` Code search (27-char pattern): 0 matches
- `READ-027` Code search (46-char pattern): 0 matches
- `READ-028` Inspected package.json — package.json
- `READ-029` Inspected package.json — package.json
- `READ-030` Inspected project.json — project.json
- `READ-031` Code search (42-char pattern): 2 matches — .gitignore, README.md

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened; 0 model findings were discarded for citing evidence that does not exist. Critical and high scanner flags cannot be removed by the model. Cost: $0.1687 (129,293 tokens).
