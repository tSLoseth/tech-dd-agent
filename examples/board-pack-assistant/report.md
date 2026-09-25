# Technology due diligence — https://github.com/tSLoseth/board-pack-assistant

_Generated 2026-09-25T19:01:07.246Z · mode: full · model: claude-haiku-4-5-20251001 · 62 files, 2,524 lines of code_

**Overall: 81/100 — Green**

> Board Pack Assistant is a well-architected early-stage SaaS tool with solid fundamentals (81/100), but requires deployment hardening and operational safeguards before production use.

## Red flags

- No CI/CD pipeline; code quality gates and automated testing are not enforced on commits or pull requests.
- External AI API calls lack rate limiting and quota enforcement, creating unbounded cost and availability risk.
- File upload endpoint has no size validation or type checking, enabling potential denial-of-service or resource exhaustion attacks.
- No containerization or infrastructure-as-code; deployment process and environment consistency are undefined.
- Single contributor with 110 days of inactivity; maintenance and support model is unclear.

## Value-creation levers

- Implement structured logging and health checks to enable production observability and reduce mean-time-to-resolution for incidents.
- Extract API client and database access into dedicated modules to reduce coupling, improve testability, and enable faster iteration on integrations.
- Expand test coverage from 10% to 60%+ of source files, focusing on API routes and export workflows, to reduce regression risk and support confident refactoring.
- Add automated dependency updates (Dependabot/Renovate) to reduce security debt and keep the v0.1.0 codebase current as it matures.
- Refactor large monolithic components and add ESLint/Prettier to improve code maintainability and reduce onboarding friction for new team members.

## 100-day plan

1. Days 1–14: Set up GitHub Actions CI/CD pipeline to run type checking, tests, and builds on every PR; add pre-commit hooks for linting and formatting.
2. Days 15–28: Implement rate limiting on AI API endpoints and add file upload validation (size, MIME type, timeout); document quota enforcement in deployment guide.
3. Days 29–42: Create Dockerfile with multi-stage build and docker-compose.yml for local development; add health check endpoints (/health, /ready) with database and API key verification.
4. Days 43–56: Extract API client logic into lib/api-client.ts and database queries into lib/db-queries.ts; add integration tests for document upload and export workflows.
5. Days 57–70: Integrate structured logging (pino or winston) with JSON output; add OpenTelemetry instrumentation for key operations (extraction, export, Q&A).
6. Days 71–100: Create infrastructure-as-code (Terraform or Vercel config) for target deployment platform; configure database connection pooling for serverless; clarify maintenance plan and onboard second contributor.

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 88 | Green | 5 |
| Code quality & tech debt | 86 | Green | 4 |
| Security | 80 | Green | 7 |
| Cloud readiness | 74 | Amber | 6 |
| Team & process | 79 | Amber | 3 |

## Findings

### Architecture & stack

- **[MEDIUM] Tight coupling between client state and API contract in workspace component** (effort M) — The board-pack-workspace.tsx component (210 lines) manages complex local state (pack, briefing, aiMode, reviews, qaTurns, etc.) and directly calls three API endpoints (/api/board-pack, /api/upload, /api/qa) with inline fetch logic. The component assumes a specific response shape and error handling pattern for each endpoint. If an API contract changes (e.g., the shape of BoardPack or the error field), the component breaks silently or requires manual updates. There is no abstraction layer (e.g., a custom hook or API client) to centralize and version these contracts.
  - Recommendation: Extract API calls into a custom hook (e.g., useBoardPackApi) or a lightweight API client module (e.g., lib/api-client.ts) that encapsulates the fetch logic, response parsing, and error handling. This will make it easier to test, version, and refactor the API contract independently of the UI.
  - Evidence: `READ-021`
- **[MEDIUM] No abstraction for database access; direct Drizzle ORM usage scattered across lib modules** (effort M) — Database queries are embedded directly in lib/extraction-store.ts and scripts/migrate.ts using Drizzle ORM. There is no data access layer (DAO or repository pattern) to abstract the database from business logic. If the schema changes or a migration is needed, multiple files must be updated. The lib/db.ts file only exports a connection; it does not provide query builders or transaction management. This makes it harder to test business logic in isolation and couples the application to Drizzle's API.
  - Recommendation: Create a lib/db-queries.ts or lib/repositories/ module that exports typed query functions (e.g., getExtraction(boardPackId), saveExtraction(...)) and hides Drizzle implementation details. This will improve testability and reduce coupling to the ORM.
  - Evidence: `READ-013`, `READ-004`
- **[INFO] Clean separation of concerns with well-defined module boundaries** (effort S) — The codebase demonstrates strong architectural discipline. The lib/ directory cleanly separates concerns: extraction logic (extraction.ts, anthropic.ts), data access (db.ts, extraction-store.ts), business logic (briefing.ts, review.ts, qa.ts), and type definitions (types.ts). API routes in app/api/ are thin and delegate to lib modules. React components in components/ are organized by feature (tabs/) with clear prop contracts. The type system (types.ts) defines a stable domain model (BoardPack, Extraction, BoardBriefing) that flows through the entire stack without leaking implementation details.
  - Recommendation: Maintain this modular structure as the codebase grows. Document the module dependency graph (e.g., lib/briefing.ts depends on lib/extraction.ts and lib/anthropic.ts) to help new contributors understand the flow.
  - Evidence: `READ-004`, `READ-012`, `READ-013`, `READ-015`, `READ-016`, `READ-021`
- **[INFO] Graceful degradation through optional AI and database layers** (effort S) — The architecture elegantly handles missing external dependencies. The app runs offline with seeded fixtures (fixtures/board-docs/) when DATABASE_URL and ANTHROPIC_API_KEY are unset. The lib/anthropic.ts module returns null on API failure, triggering fallback to deterministic extraction (lib/extraction.ts). The lib/briefing.ts buildBoardView() function transparently switches between 'anthropic-haiku' and 'deterministic-demo' modes. This is enforced by lib/model-policy.ts, which validates the model allowlist. The UI reflects the mode via ModeBadge, so users know whether output is AI-generated or deterministic.
  - Recommendation: Document this fallback behavior in the deployment guide. Consider adding a health-check endpoint that reports which layers are available (database, AI) to support monitoring in production.
  - Evidence: `READ-005`, `READ-012`, `READ-016`
- **[INFO] Framework choices (Next.js, React, Drizzle) are well-suited to the use case** (effort S) — The stack is appropriate for a full-stack web application with server-side AI integration and optional persistence. Next.js App Router provides a modern, file-based routing model and server components (used in app/page.tsx and app/api/ routes). React 19 and TypeScript ensure type safety on the client. Drizzle ORM is lightweight and type-safe, avoiding the overhead of heavier ORMs. Zod is used for runtime schema validation (lib/briefing-schema.ts, lib/anthropic.ts), which is critical for parsing AI-generated JSON. The choice to use Vitest over Jest is pragmatic for a TypeScript-first project.
  - Recommendation: No action needed. The framework choices are sound. Document the rationale in ARCHITECTURE.md for future maintainers.
  - Evidence: `READ-004`, `READ-005`

### Code quality & tech debt

- **[MEDIUM] Thin test coverage with 4 test files for 41 source files** (effort M) — The repository contains only 4 test files (anthropic.test.ts, briefing.test.ts, model-policy.test.ts, review.test.ts) covering 41 source files, yielding a test-to-source ratio of 0.10. The test suite focuses on core AI integration and board pack workflow but leaves large portions of the codebase untested, including API routes (5 files in app/api/), React components (8 files in components/), and utility modules (lib/document-loader.ts, lib/exports.ts, lib/extraction-store.ts, lib/extraction.ts, lib/review.ts). The briefing.test.ts file contains only 4 test cases despite testing multiple interdependent functions. This creates risk of regressions in component rendering, export logic, and data transformation pipelines.
  - Recommendation: Expand test coverage to at least 60% of source files, prioritizing API routes and export/transformation logic. Add integration tests for the document upload and export workflows. Use vitest's coverage reporting (already configured) to identify gaps and set a minimum coverage threshold in CI.
  - Evidence: `QUA-001`, `READ-006`, `READ-017`
- **[MEDIUM] Large monolithic component with 210 lines and multiple responsibilities** (effort M) — The board-pack-workspace.tsx component is 210 lines and manages tab state, sample questions, export menu, and multiple child components. This violates single-responsibility principle and makes the component harder to test and reuse. The component also contains inline constants (sampleQuestions, tabs) that could be extracted.
  - Recommendation: Refactor board-pack-workspace.tsx by extracting tab management into a custom hook, moving constants to a separate file, and splitting the component into smaller, focused sub-components. This will improve testability and maintainability.
  - Evidence: `READ-018`
- **[LOW] No linter or code formatter configured** (effort S) — The repository has no ESLint, Prettier, or other linting/formatting configuration. TypeScript is configured (tsconfig.json present) and vitest is set up, but there is no automated enforcement of code style, import ordering, or consistency rules. This increases maintenance burden and makes code review less efficient, particularly as the team grows.
  - Recommendation: Add ESLint with a standard configuration (e.g., eslint-config-next for Next.js projects) and Prettier for formatting. Integrate both into the build and pre-commit hooks. This is a low-effort hygiene improvement that pays dividends in maintainability.
  - Evidence: `QUA-002`, `READ-022`
- **[INFO] Comprehensive test mocking and schema validation in core AI module** (effort S) — The anthropic.test.ts file (165 lines) demonstrates strong testing practices for the most critical module: it mocks the Anthropic SDK, validates JSON schema parsing with Zod, tests error handling (missing API key, malformed output, network failures), and verifies grounding of AI-generated content against source documents. The parseJson function includes defensive parsing with fallback logic. The extraction and QA functions are tested for both success and failure paths, including citation validation.
  - Recommendation: Maintain this testing discipline as the codebase grows. Use the anthropic.test.ts pattern as a template for testing other external integrations and data transformations.
  - Evidence: `READ-006`, `READ-007`

### Security

- **[MEDIUM] No automated dependency update mechanism** (effort S) — The project has 8 runtime dependencies (including @anthropic-ai/sdk, drizzle-orm, next, postgres, react, zod) and 6 dev dependencies, but no Dependabot or Renovate configuration. This means security patches and updates must be applied manually, creating a window of exposure to known vulnerabilities in transitive dependencies.
  - Recommendation: Add a Dependabot or Renovate configuration file to automate dependency updates. At minimum, enable automated security patch PRs for production dependencies. Given the asset's early stage (v0.1.0) and inactivity (last commit 110 days ago), prioritize this before production deployment.
  - Evidence: `SEC-001`, `READ-002`
- **[MEDIUM] Dependency on external AI API with no rate limiting or quota enforcement** (effort M) — The Anthropic API integration (lib/anthropic.ts) makes unauthenticated calls to the Anthropic service when ANTHROPIC_API_KEY is configured. There is no rate limiting, request throttling, or quota enforcement in the application layer. A malicious actor with access to the deployed app could exhaust the API quota or incur unexpected costs.
  - Recommendation: Implement rate limiting on API endpoints that trigger Anthropic calls (extraction, Q&A, summarization). Use a library like `express-rate-limit` or implement token-bucket rate limiting. Set per-user or per-session quotas. Monitor API usage and set up alerts for unusual patterns. Consider implementing a request queue with backpressure.
  - Evidence: `READ-009`
- **[MEDIUM] File upload endpoint lacks size and type validation** (effort M) — The upload endpoint (app/api/upload/route.ts) accepts files via FormData and calls file.text() without validating file size, MIME type, or content. While the endpoint enforces exactly 5 files, an attacker could upload very large files to cause memory exhaustion or denial of service.
  - Recommendation: Add file size limits (e.g., max 10 MB per file, 50 MB total). Validate MIME type (accept only text/markdown or text/plain). Implement streaming or chunked parsing for large files to avoid loading entire files into memory. Add timeout protection for file processing.
  - Evidence: `READ-020`
- **[LOW] No Content Security Policy or CORS configuration** (effort S) — The Next.js application does not define explicit Content Security Policy (CSP) headers or CORS configuration in the examined files. This could allow cross-site scripting (XSS) or cross-origin attacks if the app is deployed to a public URL.
  - Recommendation: Add CSP headers via Next.js middleware or next.config.ts to restrict script sources and prevent XSS. Define explicit CORS policy if the API is intended to be called from external origins. For a single-page app deployed to Vercel, ensure the deployment URL is the only allowed origin.
  - Evidence: `READ-003`
- **[INFO] Secure secrets handling with graceful degradation** (effort S) — The application correctly handles sensitive credentials (ANTHROPIC_API_KEY, DATABASE_URL) through environment variables only, with no hardcoded secrets in the codebase. The design includes a deterministic fallback mode that allows the app to run without any secrets configured, reducing the risk of accidental exposure. The model allowlist (claude-haiku-4-5-20251001) is enforced in code, preventing unauthorized model substitution.
  - Recommendation: Continue this pattern. Document the fallback behavior in deployment guides to ensure operators understand that the app degrades gracefully without secrets, reducing pressure to configure them in non-production environments.
  - Evidence: `READ-009`, `READ-010`, `READ-011`, `READ-019`
- **[INFO] Input validation and schema enforcement on API endpoints** (effort S) — API routes use Zod schema validation to parse and validate incoming requests before processing. The upload endpoint validates file count (exactly 5 documents required), the QA endpoint validates question length (3–500 characters), and the extraction logic validates JSON responses against strict schemas. This reduces the risk of injection attacks and malformed data propagation.
  - Recommendation: Maintain this pattern as new endpoints are added. Ensure all user-supplied input (file names, question text, document content) continues to be validated before use in downstream operations.
  - Evidence: `READ-020`, `READ-023`, `READ-009`
- **[INFO] Parameterized database queries via ORM** (effort S) — The codebase uses Drizzle ORM for all database interactions, which provides parameterized query construction and prevents SQL injection. No raw SQL queries or string concatenation for SQL construction were found in the examined files.
  - Recommendation: Continue using Drizzle ORM exclusively. If raw SQL becomes necessary in the future, use parameterized queries only and conduct security review.
  - Evidence: `READ-010`, `READ-025`, `READ-026`

### Cloud readiness

- **[MEDIUM] No containerisation for deployment** (effort S) — The asset lacks a Dockerfile or Docker Compose configuration. While the README documents deployment to Vercel as a standard Next.js app, there is no container image definition for alternative cloud platforms (AWS ECS, GCP Cloud Run, Kubernetes) or self-hosted environments. This limits deployment flexibility and increases operational friction for buyers who do not use Vercel.
  - Recommendation: Add a Dockerfile with multi-stage build (Node 20+ base, build stage, production runtime) and optionally a docker-compose.yml for local development. This enables deployment to any container-capable platform and improves consistency between dev and production.
  - Evidence: `CLD-001`
- **[MEDIUM] No infrastructure-as-code or deployment manifests** (effort M) — The repository contains no Terraform, CloudFormation, Helm charts, or Kubernetes manifests. Deployment is documented only as a manual Vercel import with environment variables set in the UI. This creates operational risk: no reproducible, version-controlled infrastructure definition; no audit trail for infrastructure changes; and no ability to spin up staging or disaster-recovery environments programmatically.
  - Recommendation: Create infrastructure-as-code for the target deployment platform. For Vercel, use Vercel's API or Terraform provider. For self-hosted, provide Kubernetes manifests or Terraform for AWS/GCP. Include database provisioning (Neon Postgres connection pooling for serverless) and secrets management (AWS Secrets Manager, GCP Secret Manager, or Kubernetes secrets).
  - Evidence: `CLD-002`
- **[MEDIUM] No observability or logging configuration** (effort M) — The codebase contains no structured logging, tracing, or metrics collection. Error handling is minimal (e.g., console.warn in lib/anthropic.ts when AI calls fail). There are no health checks, readiness probes, or liveness probes suitable for Kubernetes or container orchestration. This makes it difficult to monitor the app in production, diagnose failures, or set up alerting.
  - Recommendation: Integrate a structured logging library (e.g., pino, winston) that outputs JSON logs suitable for cloud log aggregation (CloudWatch, Stackdriver, ELK). Add health check endpoints (/health, /ready) that verify database connectivity and API key availability. Instrument key operations (extraction, export, Q&A) with timing and error metrics. Consider adding OpenTelemetry for distributed tracing if the app scales to multiple services.
  - Evidence: `READ-032`
- **[MEDIUM] Database connection pooling not configured for serverless** (effort S) — The README mentions using Neon's 'pooled connection string for the serverless runtime', but the code in lib/db.ts does not enforce or validate this. The postgres client is instantiated with `{ prepare: false }` to avoid prepared statement issues, but there is no explicit connection pool configuration, timeout settings, or retry logic. In a serverless environment (Vercel Functions, AWS Lambda), connection exhaustion is a common failure mode.
  - Recommendation: Add explicit connection pool configuration in lib/db.ts: set max connections, idle timeout, and connection timeout appropriate for serverless (e.g., max 5–10 connections, 30s idle timeout). Document the requirement to use Neon's pooled connection string in a deployment checklist. Add a health check that verifies the database connection pool is healthy at startup.
  - Evidence: `READ-030`, `READ-029`
- **[LOW] 12-factor configuration partially implemented** (effort S) — The app correctly reads configuration from environment variables (DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL) as shown in lib/anthropic.ts, lib/db.ts, lib/model-policy.ts, and scripts/migrate.ts. However, there is no validation or schema enforcement for required vs. optional variables at startup. The app silently degrades when DATABASE_URL or ANTHROPIC_API_KEY are unset, which is intentional but lacks explicit documentation of which variables are required for each deployment mode.
  - Recommendation: Add a startup validation function that logs which mode the app is running in (e.g., 'Running with database and AI' vs. 'Running with fixtures only') and warns if optional secrets are missing. Document the three deployment modes: (1) fixtures only, (2) database + deterministic fallback, (3) database + AI. Consider using a schema validation library (e.g., Zod, which is already a dependency) to validate environment at boot.
  - Evidence: `CLD-003`, `READ-028`, `READ-030`
- **[INFO] Graceful degradation and optional dependencies well-designed** (effort S) — The app demonstrates strong cloud-native design in its handling of optional dependencies. Both the database (Neon Postgres) and AI service (Anthropic API) are optional; the app falls back to seeded fixtures and deterministic extraction when either is unavailable. The README clearly documents this, and a mode badge in the UI shows whether output came from AI or the fallback. This design reduces operational complexity and allows the app to run in degraded mode without silent failures.
  - Recommendation: Maintain this pattern as the app evolves. Document the fallback behavior in runbooks and ensure monitoring alerts distinguish between 'running on fallback' (expected in some deployments) and 'fallback due to service failure' (actionable incident).
  - Evidence: `READ-029`, `READ-030`

### Team & process

- **[HIGH] No CI/CD pipeline configured** (effort S) — The repository has no GitHub Actions, GitLab CI, CircleCI, or other CI/CD configuration. The package.json defines build, test, and typecheck scripts, but there is no automated pipeline to run them on commits or pull requests. This means code changes are not automatically validated before merge, increasing the risk of broken builds or untested code reaching production.
  - Recommendation: Add a GitHub Actions workflow (or equivalent CI system) that runs `npm run typecheck`, `npm test`, and `npm run build` on every pull request and commit to main. This should block merges if any step fails.
  - Evidence: `TEAM-001`, `READ-035`, `READ-037`
- **[MEDIUM] Single contributor and no recent activity** (effort S) — The repository has only 4 commits by 1 contributor, with the last commit 110 days ago and no activity in the last 90 days. The bus factor is 1 (100% of commits from one author). While the commit history is too short to formally assess key-person risk, the combination of single authorship, dormancy, and minimal commit volume indicates the project is either abandoned or heavily dependent on one person. This creates operational risk for ongoing maintenance and support.
  - Recommendation: Clarify the project's status and maintenance plan with the current team. If active development is expected, establish a plan to onboard additional contributors and distribute knowledge. If the project is stable and feature-complete, document the maintenance expectations and support model.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[INFO] Comprehensive README and project documentation** (effort S) — The repository includes a well-structured 134-line README with clear setup instructions, feature overview, tech stack, responsible AI design principles, deployment guidance, and project structure. Additional documentation files (PROJECT_SPEC.md, DATA_MODEL.md, ROADMAP.md, AI_POLICY.md, EVALS.md) provide context for the application's design and governance. This is a strength for onboarding and understanding the asset's scope and constraints.
  - Recommendation: Maintain this documentation standard as the project evolves. Consider adding a CONTRIBUTING.md file to guide future contributors on development workflow and code standards.
  - Evidence: `TEAM-002`, `READ-033`

## Evidence

- `ARC-001` 2,524 lines of code: TypeScript 100%
- `ARC-002` npm manifest package.json: 8 runtime and 6 dev dependencies — package.json
- `ARC-003` Frameworks detected: Drizzle ORM, Next.js, React
- `QUA-001` 4 test files for 41 source files (ratio 0.10)
- `TEAM-001` No CI configuration found
- `QUA-002` No linter or formatter configuration found
- `TEAM-002` README present (134 lines) — README.md
- `SEC-001` No Dependabot or Renovate configuration found
- `CLD-001` No Dockerfile or compose file found
- `CLD-002` No infrastructure-as-code or deployment configuration found
- `CLD-003` Configuration read from environment variables in 5 files (12-factor) — lib/anthropic.ts, lib/db.ts, lib/model-policy.ts, scripts/migrate.ts, scripts/seed-demo.ts
- `TEAM-003` 4 commits by 1 contributors since 2026-06; 0 in the last 90 days; last commit 110 days ago; history too short to assess key-person risk (4 commits)
- `TEAM-004` Bus factor 1: top contributor authored 100% of commits
- `READ-001` Code search (17-char pattern): 1 matches — vitest.config.ts
- `READ-002` Inspected package.json — package.json
- `READ-003` Inspected README.md — README.md
- `READ-004` Inspected package.json — package.json
- `READ-005` Inspected README.md — README.md
- `READ-006` Inspected tests/anthropic.test.ts — tests/anthropic.test.ts
- `READ-007` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-008` Inspected package.json — package.json
- `READ-009` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-010` Inspected lib/db.ts — lib/db.ts
- `READ-011` Inspected lib/model-policy.ts — lib/model-policy.ts
- `READ-012` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-013` Inspected db/schema.ts — db/schema.ts
- `READ-014` Code search (15-char pattern): 50 matches — .gitignore, app/api/board-pack/route.ts, app/api/export/markdown/route.ts, app/api/export/pdf/route.ts, app/api/qa/route.ts
- `READ-015` Inspected lib/types.ts — lib/types.ts
- `READ-016` Inspected lib/briefing.ts — lib/briefing.ts
- `READ-017` Inspected tests/briefing.test.ts — tests/briefing.test.ts
- `READ-018` Code search (46-char pattern): 50 matches — app/api/board-pack/route.ts, app/api/export/markdown/route.ts, app/api/export/pdf/route.ts, app/api/qa/route.ts, app/api/upload/route.ts
- `READ-019` Inspected .env.example — .env.example
- `READ-020` Inspected app/api/upload/route.ts — app/api/upload/route.ts
- `READ-021` Inspected components/board-pack-workspace.tsx — components/board-pack-workspace.tsx
- `READ-022` Code search (29-char pattern): 9 matches — AI_POLICY.md, db/schema.ts, fixtures/board-docs/05-hr-and-governance-update.md, next-env.d.ts, package-lock.json
- `READ-023` Inspected app/api/qa/route.ts — app/api/qa/route.ts
- `READ-024` Code search (29-char pattern): 20 matches — fixtures/board-docs/01-q3-finance-update.md, fixtures/board-docs/02-risk-and-compliance-note.md, fixtures/board-docs/03-supplier-contract-renewal.md, fixtures/board-docs/04-product-expansion-proposal.md, fixtures/board-docs/05-hr-and-governance-update.md
- `READ-025` Inspected db/schema.ts — db/schema.ts
- `READ-026` Code search (33-char pattern): 0 matches
- `READ-027` Inspected package.json — package.json
- `READ-028` Inspected .env.example — .env.example
- `READ-029` Inspected README.md — README.md
- `READ-030` Inspected lib/db.ts — lib/db.ts
- `READ-031` Inspected next.config.ts — next.config.ts
- `READ-032` Code search (35-char pattern): 20 matches — .env.example, app/api/qa/route.ts, components/ui/ModeBadge.tsx, lib/anthropic.ts, lib/briefing-schema.ts
- `READ-033` Inspected README.md — README.md
- `READ-034` Code search (35-char pattern): 1 matches — README.md
- `READ-035` Inspected package.json — package.json
- `READ-036` Code search (18-char pattern): 0 matches
- `READ-037` Code search (54-char pattern): 0 matches

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened. 0 model findings were discarded for citing evidence that does not exist, and 3 findings were removed as cross-dimension duplicates. Critical and high scanner flags cannot be removed by the model. Cost: $0.2343 (193,493 tokens).
