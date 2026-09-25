# Technology due diligence — https://github.com/tSLoseth/board-pack-assistant

_Generated 2026-09-25T18:37:39.656Z · mode: full · model: claude-haiku-4-5-20251001 · 62 files, 2,524 lines of code_

**Overall: 72/100 — Amber**

> Solid foundation with strong security and architecture, but cloud deployment readiness and test coverage gaps must be addressed before production use.

## Red flags

- No containerization or infrastructure-as-code: manual deployment and environment setup required, blocking cloud scalability
- Critical bus factor: single contributor with 100% commit history and 110-day dormancy; no second maintainer or clear maintenance plan post-acquisition
- Minimal test coverage (4 tests for 41 files) with no integration tests for API contracts, creating brittleness in production
- No production observability: missing logging, metrics, and health checks required for cloud operations and incident response
- Database connection pooling not configured for serverless environments, risking connection exhaustion under load

## Value-creation levers

- Implement containerization and infrastructure-as-code to enable one-command deployment to any cloud platform and support CI/CD automation
- Build test coverage to 60% minimum on critical paths (API routes, extraction, exports) to reduce production incidents and enable safe refactoring
- Add structured logging and metrics collection to unlock observability, enabling faster incident diagnosis and performance optimization
- Refactor monolithic components and extract shared API schemas to reduce brittleness and improve developer velocity for feature additions
- Establish extensibility interfaces for AI providers and exporters to enable multi-provider support and reduce vendor lock-in

## 100-day plan

1. Days 1–14: Assign second maintainer, document critical workflows, and clarify post-acquisition maintenance model and roadmap
2. Days 15–30: Create Dockerfile with multi-stage build and docker-compose.yml for local development; add configuration validation module using Zod
3. Days 31–45: Write integration tests for board-pack and export API routes; add structured logging (pino/winston) and /health endpoint
4. Days 46–60: Implement Terraform or Pulumi configuration for target cloud platform (Vercel + Neon or AWS equivalent); configure database connection pooling
5. Days 61–75: Add ESLint and Prettier to build pipeline; extract Zod schemas into shared lib/validation.ts module; refactor board-pack-workspace into smaller components
6. Days 76–100: Integrate Dependabot for automated dependency updates; add metrics collection (Prometheus/CloudWatch); document deployment guides for cost-optimized and production modes

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 86 | Green | 4 |
| Code quality & tech debt | 69 | Amber | 6 |
| Security | 94 | Green | 4 |
| Cloud readiness | 43 | Red | 6 |
| Team & process | 70 | Amber | 3 |

## Findings

### Architecture & stack

- **[MEDIUM] Tight coupling between frontend state and API contracts creates brittleness** (effort M) — The React component `board-pack-workspace.tsx` directly manages complex state (pack, briefing, reviews, QA turns) and makes untyped fetch calls to API routes. The API responses are cast to inline types (e.g., `as Omit<QaTurn, "question">`) without schema validation. If an API route changes its response shape, the frontend will silently fail or crash at runtime. The `applyReviewsToBriefing` function is called on every render with `useMemo`, but the review state is mutable and could diverge from the briefing if the briefing is regenerated. There is no shared schema validation (e.g., Zod) between client and server to catch contract violations early.
  - Recommendation: Extract API response types into shared Zod schemas in `lib/` and validate responses on the client. Use a type-safe fetch wrapper or tRPC to eliminate the gap between frontend expectations and API contracts. Add integration tests that verify the client and server agree on response shapes.
  - Evidence: `READ-022`, `READ-004`
- **[MEDIUM] Monolithic component with high internal state complexity** (effort M) — The `board-pack-workspace.tsx` component manages 11 pieces of state (pack, briefing, aiMode, activeTab, activeDocumentId, question, qaTurns, isAsking, isRegenerating, isUploaded, uploadStatus, reviews) and orchestrates three async workflows (askQuestion, regenerate, uploadDocuments). This violates the single-responsibility principle and makes the component difficult to test, extend, and reason about. State transitions are implicit (e.g., resetting reviews when a new pack is uploaded happens in three places). The component is 210 lines and would benefit from decomposition into smaller, focused components or a state management library.
  - Recommendation: Refactor the workspace into smaller components: extract tab content into separate components that receive only the data they need, move async workflows into custom hooks (e.g., `useUploadWorkflow`, `useRegenerateWorkflow`), and consider adopting a state management library (e.g., Zustand, Jotai) or useReducer to centralize state transitions and make them explicit.
  - Evidence: `READ-022`
- **[LOW] Framework choices are appropriate but lack extensibility hooks** (effort M) — The stack (Next.js, React, Drizzle ORM, Zod, Anthropic SDK) is well-suited to the use case: Next.js provides server-side rendering and API routes, Drizzle is lightweight and type-safe, and Zod enables runtime validation. However, the architecture lacks extension points for alternative AI providers, export formats, or document parsers. The Anthropic integration is hardcoded in `lib/anthropic.ts` and `lib/model-policy.ts`. Adding support for a different LLM or export format would require modifying core files rather than plugging in a new module. The extraction logic is tightly coupled to the Anthropic schema.
  - Recommendation: Define an interface for AI providers (e.g., `interface LlmProvider { extract(...): Promise<Extraction> }`) and move Anthropic-specific logic behind it. Similarly, define an interface for exporters and document parsers. This will make it easier to add new providers without modifying core logic.
  - Evidence: `READ-012`, `ARC-003`
- **[INFO] Clean separation of concerns with well-defined module boundaries** (effort S) — The codebase demonstrates strong architectural discipline. Core business logic is cleanly separated into focused modules: `lib/extraction.ts` and `lib/anthropic.ts` handle AI/extraction logic, `lib/briefing.ts` orchestrates board pack assembly, `lib/document-loader.ts` manages document parsing, and `lib/exports.ts` handles output formatting. API routes in `app/api/` are thin wrappers that delegate to these libraries. React components in `components/` are organized by feature (tabs, UI primitives) and maintain clear data flow through props and callbacks. Type definitions in `lib/types.ts` are centralized and comprehensive, enabling type-safe contracts across modules.
  - Recommendation: Maintain this modular structure as the codebase grows. Document the module responsibilities in a CONTRIBUTING guide to help new team members understand the architecture.
  - Evidence: `READ-012`, `READ-013`, `READ-017`, `READ-018`, `READ-022`

### Code quality & tech debt

- **[HIGH] Thin test coverage with 4 tests for 41 source files** (effort M) — The repository contains only 4 test files (anthropic.test.ts, briefing.test.ts, model-policy.test.ts, review.test.ts) covering 41 source files across app/, components/, lib/, and scripts/ directories. The test-to-source ratio of 0.10 is well below industry standard (typically 0.3–0.5). Critical paths like API routes (board-pack, qa, upload, export/markdown, export/pdf), UI components (ActionsTab, BriefingTab, DocumentsTab, QaTab, ExportMenu, UploadControl), and utility modules (document-loader, extraction, exports, extraction-store) have no test coverage. The existing tests focus narrowly on the Anthropic integration and briefing workflow, leaving data transformation, export logic, and UI behavior untested.
  - Recommendation: Establish a minimum coverage target of 60% for critical paths (API routes, extraction, exports, review logic). Prioritize tests for document-loader, extraction-store, exports, and qa modules. Add integration tests for the board-pack and export API routes. Use vitest's coverage reporting (already configured) to track progress.
  - Evidence: `QUA-001`, `READ-006`, `READ-015`, `READ-016`
- **[MEDIUM] Large monolithic components with mixed concerns** (effort M) — Several UI components are oversized and combine multiple responsibilities. For example, board-pack-workspace.tsx is 210 lines and handles tab state, data fetching, and rendering; ActionsTab.tsx is 150 lines; BriefingTab.tsx is 152 lines. The lib/anthropic.ts module is 218 lines and contains multiple schema definitions, prompt templates, and API call logic. These modules are difficult to test in isolation and harder to refactor. The lack of test coverage for these components (READ-016 shows no tests for components/) compounds the risk.
  - Recommendation: Refactor large components into smaller, single-responsibility units. Extract schema definitions and prompt templates from lib/anthropic.ts into separate modules. Break board-pack-workspace.tsx into smaller presentational and container components. This will improve testability and maintainability.
  - Evidence: `READ-007`, `READ-016`
- **[MEDIUM] Deterministic fallback mode masks missing API integration tests** (effort M) — The codebase includes a 'deterministic-demo' mode (READ-015) that returns hardcoded results when the Anthropic API key is absent. While this enables offline testing, it also means the test suite does not validate the actual API contract or error handling in production scenarios. The tests mock the Anthropic SDK entirely (READ-006) rather than testing real API calls or realistic failure modes. This leaves integration risks undetected.
  - Recommendation: Add integration tests that call the real Anthropic API (or a test endpoint) with sample board packs to validate the contract and error handling. Consider using a test API key and a separate test suite that runs less frequently. Document the fallback behavior and ensure it is only used in demo/offline scenarios, not in production.
  - Evidence: `READ-006`, `READ-015`
- **[LOW] No linter or code formatter configured** (effort S) — The repository has no ESLint, Prettier, Biome, or other linting/formatting configuration. TypeScript is configured (tsconfig.json present) and type-checking is available via the 'typecheck' script, but there is no automated enforcement of code style, import ordering, or consistency rules. This increases the risk of style drift, inconsistent naming, and harder code review.
  - Recommendation: Add ESLint with a standard config (e.g., eslint-config-next for Next.js projects) and Prettier for formatting. Integrate both into the build pipeline and pre-commit hooks. This is a low-effort hygiene improvement that will improve maintainability.
  - Evidence: `QUA-002`, `READ-019`
- **[LOW] Zod schemas used for validation but not exported for reuse** (effort S) — The lib/anthropic.ts module defines Zod schemas (summarySchema, extractionSchema, qaSchema) for validating AI model output, but these schemas are not exported or reused elsewhere. This creates duplication risk if other modules need to validate similar structures, and makes it harder to maintain a single source of truth for data contracts.
  - Recommendation: Extract Zod schemas into a dedicated lib/schemas.ts or lib/validation.ts module and export them for reuse. This will improve maintainability and reduce duplication.
  - Evidence: `READ-007`
- **[INFO] Comprehensive type safety and error handling in core extraction logic** (effort S) — The codebase demonstrates strong type safety practices: TypeScript is strict (tsconfig.json configured), Zod is used for runtime validation of AI model output, and error handling is defensive (e.g., parseJson gracefully handles malformed JSON, runHaiku returns null on API failure). The anthropic.test.ts file includes tests for malformed output, missing API keys, and network failures, showing awareness of failure modes. This is a strength for a system that depends on external AI APIs.
  - Recommendation: Continue this practice: maintain strict TypeScript, use Zod for all external data, and test error paths. Document the fallback behavior and ensure it is safe for production.
  - Evidence: `READ-006`, `READ-007`

### Security

- **[MEDIUM] No automated dependency update mechanism** (effort S) — The repository has no Dependabot or Renovate configuration. With 8 runtime dependencies (including @anthropic-ai/sdk, drizzle-orm, next, postgres, react, zod) and 6 dev dependencies, the codebase relies on manual updates to address security patches. The package-lock.json is present but there is no automation to detect or apply updates, creating a supply-chain risk window.
  - Recommendation: Add a Dependabot or Renovate configuration file (.github/dependabot.yml or renovate.json) to automate dependency updates. Configure it to create pull requests for security patches at minimum, and consider weekly or monthly updates for minor/patch versions.
  - Evidence: `SEC-001`, `READ-002`
- **[INFO] Secure secrets handling with graceful degradation** (effort S) — The application demonstrates responsible secrets handling. Environment variables (ANTHROPIC_API_KEY, DATABASE_URL, ANTHROPIC_MODEL) are read from process.env and are optional. The code includes a canUseAnthropic() guard that returns null if the API key is absent, allowing the app to run with deterministic fallbacks. The .env.example file documents required variables without exposing values. Database connections use parameterized queries via Drizzle ORM, eliminating SQL injection risk. File uploads are validated (exactly 5 documents required) and parsed safely.
  - Recommendation: Continue this pattern. Ensure .env.local is in .gitignore (verify in .gitignore) and document in deployment guides that ANTHROPIC_API_KEY and DATABASE_URL must never be committed.
  - Evidence: `READ-009`, `READ-010`, `READ-011`, `READ-020`, `READ-021`, `READ-023`
- **[INFO] Model allowlist enforcement prevents prompt injection via model selection** (effort S) — The model-policy.ts enforces a strict allowlist: only claude-haiku-4-5-20251001 is permitted. The resolveModel() function throws an error if ANTHROPIC_MODEL environment variable differs from the allowed model, preventing an attacker from injecting a different model via environment tampering. This is a strong control for a system that processes board documents.
  - Recommendation: Maintain this allowlist pattern. Document the rationale (cost, safety, eval coverage) in AI_POLICY.md for future maintainers.
  - Evidence: `READ-011`
- **[INFO] Extraction and Q&A grounding prevents hallucination-based data leakage** (effort S) — The extraction and Q&A logic includes explicit grounding controls: the system prompts instruct the model to use only supplied documents, mark unknown values as 'Unknown' rather than fabricate them, and cite every item back to a source document. The code validates that cited documentIds exist in the input set before surfacing results (see extraction-store.ts and anthropic.ts cite() function). This reduces the risk of the model inventing sensitive information or leaking training data.
  - Recommendation: Continue this pattern in any future AI integrations. Add a test case that verifies rejected citations (unknown documentIds) are dropped from output.
  - Evidence: `READ-009`, `READ-023`

### Cloud readiness

- **[HIGH] No containerisation — manual deployment and environment setup required** (effort M) — The asset is a Next.js full-stack application with no Dockerfile or Docker Compose configuration. Deployment requires manual Node environment setup, database provisioning, and environment variable configuration. This increases operational friction, makes scaling unpredictable, and complicates CI/CD integration. The README documents manual setup steps (npm install, db:migrate, db:seed) but provides no container image for reproducible deployment.
  - Recommendation: Create a Dockerfile with multi-stage build (dev and production stages) and a docker-compose.yml for local development. Include health checks and ensure the image respects the Node >=20 requirement. This enables one-command deployment to any cloud platform and simplifies CI/CD.
  - Evidence: `CLD-001`, `READ-025`, `READ-026`
- **[HIGH] No infrastructure-as-code — cloud deployment requires manual configuration** (effort M) — The asset has no Terraform, CloudFormation, Pulumi, or other IaC configuration. The README mentions Vercel deployment as the reference path but provides no automation for provisioning Neon Postgres, setting secrets, or configuring the serverless environment. Each deployment environment (staging, production) requires manual setup, increasing risk of configuration drift and making disaster recovery or multi-region deployment difficult.
  - Recommendation: Create Terraform or Pulumi configuration for the target cloud platform (Vercel + Neon, or AWS/GCP equivalent). Define database, secrets manager, and application deployment as code. This enables repeatable, auditable infrastructure and supports blue-green or canary deployments.
  - Evidence: `CLD-002`, `READ-026`
- **[HIGH] No observability instrumentation — no logging, metrics, or tracing for production** (effort M) — The codebase contains no structured logging, metrics collection, or distributed tracing. Error handling is minimal (e.g., lib/anthropic.ts logs a warning on API failure but does not emit metrics or structured logs). There is no health check endpoint, no readiness probe, and no way to monitor database connection pool status or API latency in production. This makes debugging production issues, capacity planning, and SLA monitoring impossible.
  - Recommendation: Integrate a logging library (e.g., pino or winston) with structured JSON output. Add metrics collection (e.g., Prometheus client or CloudWatch) for request latency, error rates, and database pool status. Implement a /health endpoint for Kubernetes or load balancer health checks. Consider adding OpenTelemetry for distributed tracing if the asset will be part of a larger system.
  - Evidence: `READ-028`
- **[MEDIUM] 12-factor configuration partially implemented — environment variables used but no validation or documentation** (effort S) — The asset reads configuration from environment variables (DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL) in 5 files (lib/anthropic.ts, lib/db.ts, lib/model-policy.ts, scripts/migrate.ts, scripts/seed-demo.ts) and includes a .env.example file. However, there is no runtime validation of required variables, no schema definition, and no clear documentation of which variables are mandatory vs. optional. The code gracefully degrades when DATABASE_URL is unset (using fixtures) but does not validate ANTHROPIC_MODEL format or warn if ANTHROPIC_API_KEY is missing but ANTHROPIC_MODEL is set.
  - Recommendation: Add a configuration validation module (e.g., using Zod, which is already a dependency) that runs at startup and validates all environment variables against a schema. Document which variables are required, optional, and their expected formats. Fail fast with clear error messages if required variables are missing or invalid.
  - Evidence: `CLD-003`, `READ-027`, `READ-028`
- **[MEDIUM] Database connection pooling not configured for serverless — risk of connection exhaustion** (effort S) — The database connection is created via postgres-js without explicit pooling configuration (lib/db.ts uses `postgres(url, { prepare: false })`). The README mentions using Neon's pooled connection string for serverless, but the code does not enforce or validate this. In a serverless environment (Vercel), each function invocation creates a new connection, risking rapid pool exhaustion and connection timeouts under load.
  - Recommendation: Configure postgres-js with explicit pool settings (max connections, idle timeout) or use Neon's built-in connection pooler (PgBouncer). Add validation to reject non-pooled connection strings at startup. Document the pooled connection string requirement prominently in deployment guides.
  - Evidence: `READ-028`, `READ-026`
- **[INFO] Graceful degradation design enables low-cost deployment without external services** (effort S) — The asset is architected to run without external dependencies: DATABASE_URL and ANTHROPIC_API_KEY are both optional. When unset, the app falls back to seeded fixture data and deterministic extraction, allowing full functionality without Neon Postgres or Anthropic API. A mode badge transparently indicates whether output came from AI or the fallback. This design significantly reduces operational cost and complexity for small deployments or demos, and simplifies local development.
  - Recommendation: Document this graceful degradation as a deployment option in the README. Provide a cost-optimized deployment guide for running on Vercel free tier with fixtures only, and a production guide for enabling the database and AI layers incrementally.
  - Evidence: `READ-026`, `READ-028`

### Team & process

- **[HIGH] Critical bus factor: single contributor with 100% commit history** (effort M) — The repository has only 1 contributor who authored 100% of the 4 commits since June 2026. This creates a single point of failure for knowledge, maintenance, and future development. There is no evidence of code review, pair programming, or knowledge distribution across a team.
  - Recommendation: Establish a second maintainer or core team member with commit access and involve them in code reviews and architectural decisions. Document critical workflows and decision rationale in the codebase and wiki.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[HIGH] Repository dormant for 110 days with no recent development activity** (effort S) — The last commit was 110 days ago, and there have been zero commits in the last 90 days. For a 2,524-line TypeScript application with optional AI and database integrations, this suggests the project is not actively maintained or developed. This raises questions about the team's capacity to support or evolve the asset post-acquisition.
  - Recommendation: Clarify the intended maintenance model post-acquisition. If the asset is to be actively developed, establish a development roadmap and assign dedicated team capacity. If it is stable/archived, document that status and define a support SLA.
  - Evidence: `TEAM-003`
- **[INFO] Comprehensive README and clear project structure support onboarding** (effort S) — The README is well-structured (134 lines) with clear sections on features, tech stack, getting started, scripts, project structure, and deployment. It includes optional environment setup, database migration steps, and references to supplementary docs (AI_POLICY.md, EVALS.md, PROJECT_SPEC.md, DATA_MODEL.md, ROADMAP.md). The codebase is organized into logical directories (app/, components/, lib/, db/, scripts/, fixtures/, tests/) with clear separation of concerns.
  - Recommendation: Maintain this documentation standard as the team grows. Consider adding a CONTRIBUTING.md file to codify development practices and code review expectations.
  - Evidence: `TEAM-002`, `READ-031`

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
- `TEAM-003` 4 commits by 1 contributors since 2026-06; 0 in the last 90 days; last commit 110 days ago
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
- `READ-015` Inspected tests/briefing.test.ts — tests/briefing.test.ts
- `READ-016` Code search (33-char pattern): 4 matches — README.md
- `READ-017` Inspected lib/types.ts — lib/types.ts
- `READ-018` Inspected lib/briefing.ts — lib/briefing.ts
- `READ-019` Code search (28-char pattern): 0 matches
- `READ-020` Inspected .env.example — .env.example
- `READ-021` Inspected app/api/upload/route.ts — app/api/upload/route.ts
- `READ-022` Inspected components/board-pack-workspace.tsx — components/board-pack-workspace.tsx
- `READ-023` Inspected lib/extraction-store.ts — lib/extraction-store.ts
- `READ-024` Code search (25-char pattern): 20 matches — fixtures/board-docs/01-q3-finance-update.md, fixtures/board-docs/02-risk-and-compliance-note.md, fixtures/board-docs/03-supplier-contract-renewal.md, fixtures/board-docs/04-product-expansion-proposal.md, fixtures/board-docs/05-hr-and-governance-update.md
- `READ-025` Inspected package.json — package.json
- `READ-026` Inspected README.md — README.md
- `READ-027` Inspected .env.example — .env.example
- `READ-028` Inspected lib/db.ts — lib/db.ts
- `READ-029` Inspected next.config.ts — next.config.ts
- `READ-030` Code search (35-char pattern): 20 matches — .env.example, app/api/qa/route.ts, components/ui/ModeBadge.tsx, lib/anthropic.ts, lib/briefing-schema.ts
- `READ-031` Inspected README.md — README.md
- `READ-032` Inspected package.json — package.json
- `READ-033` Code search (16-char pattern): 0 matches

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened; 0 model findings were discarded for citing evidence that does not exist. Critical and high scanner flags cannot be removed by the model. Cost: $0.2130 (170,523 tokens).
