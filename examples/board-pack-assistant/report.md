# Technology due diligence — https://github.com/tSLoseth/board-pack-assistant

_Generated 2026-09-25T18:28:10.071Z · mode: full · model: claude-haiku-4-5-20251001 · 62 files, 2,524 lines of code_

**Overall: 68/100 — Red**

> Solid technical foundation with strong architecture and security, but critical team and process gaps create operational risk that must be resolved before close.

## Red flags

- Single developer with no recent activity and zero documented knowledge transfer—creates complete dependency risk for deployment, database operations, and incident response.
- Minimal test coverage (4 tests across 41 files) with no enforcement mechanism—production asset lacks quality gates for reliability.
- No CI/CD pipeline, containerization, or deployment configuration—cannot reliably deploy or scale without significant post-close engineering.
- No observability, logging, or monitoring infrastructure—impossible to diagnose production issues or track performance.

## Value-creation levers

- Establish automated testing and CI/CD pipeline to catch regressions early and enable confident deployments—foundation for scaling.
- Add containerization and infrastructure-as-code (Terraform/Helm) to enable cost-effective self-hosted deployment and reduce vendor lock-in.
- Implement structured logging and metrics collection for production observability—essential for SaaS reliability and customer support.
- Refactor monolithic component state and tighten dependency abstractions to improve testability and reduce technical debt.
- Add automated dependency updates and security scanning to reduce maintenance burden and keep the asset current.

## 100-day plan

1. Days 1–14: Hire or assign a second engineer; conduct full knowledge transfer on deployment, database migrations, API integrations, and incident response; document runbooks for common operational tasks.
2. Days 15–30: Implement CI/CD pipeline (GitHub Actions) to run tests, type checks, and builds on every commit; add ESLint and Prettier for code quality enforcement.
3. Days 31–50: Write integration tests for core workflows (upload → briefing → export, Q&A, regeneration) targeting 60% coverage; add API route validation tests.
4. Days 51–70: Add Dockerfile, docker-compose.yml, and production deployment templates (Terraform or Helm); implement structured logging (pino/winston) and basic metrics.
5. Days 71–85: Refactor BoardPackWorkspace state into custom hooks; introduce extraction strategy and LLM provider interfaces to decouple business logic from external dependencies.
6. Days 86–100: Enable Dependabot for automated dependency updates; add file upload validation (type, size, rate limiting); document deployment guide and runbooks for handoff to operations.

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 80 | Green | 6 |
| Code quality & tech debt | 71 | Amber | 6 |
| Security | 80 | Green | 7 |
| Cloud readiness | 71 | Amber | 5 |
| Team & process | 38 | Red | 5 |

## Findings

### Architecture & stack

- **[MEDIUM] Tight coupling between AI and deterministic extraction paths in briefing orchestration** (effort M) — The buildBoardView function in lib/briefing.ts (READ-016) orchestrates both AI and deterministic extraction, but the logic for choosing between them is implicit: it tries AI first, falls back to deterministic if AI returns null, and sets aiMode based on whether both AI extraction and summary succeeded. This creates a hidden dependency: if the AI layer changes its error handling or return types, the fallback logic may silently degrade. The function also directly calls extractBoardPackWithAi and summarizeExecutiveSummary, making it hard to swap implementations or test different strategies. The aiMode flag is set after the fact rather than being a first-class parameter, which makes the control flow harder to reason about.
  - Recommendation: Introduce an explicit extraction strategy interface or factory pattern. Define a contract like `interface ExtractionStrategy { extract(docs): Promise<Extraction | null> }` with concrete implementations for AI and deterministic paths. Pass the strategy to buildBoardView rather than hardcoding the fallback logic. This will make the code more testable and easier to extend with new extraction methods.
  - Evidence: `READ-016`
- **[MEDIUM] Monolithic component state management in BoardPackWorkspace** (effort M) — The BoardPackWorkspace component (READ-022) manages 11 pieces of state (pack, briefing, aiMode, activeTab, activeDocumentId, question, qaTurns, isAsking, isRegenerating, isUploaded, uploadStatus, reviews) and four async operations (askQuestion, regenerate, uploadDocuments, resetDemo) in a single 210-line component. This creates a high cognitive load and makes it difficult to test individual features or reuse state logic. The component is responsible for both UI orchestration and business logic (e.g., calling /api/qa, /api/board-pack, /api/upload). State updates are scattered across multiple handlers, and the relationship between reviews and reviewedBriefing (computed via useMemo) is not immediately obvious.
  - Recommendation: Extract state management into a custom hook (e.g., useBoardPackWorkspace) or a context provider. Separate concerns: one hook for pack/briefing/aiMode lifecycle, another for UI state (activeTab, activeDocumentId), and another for async operations. This will improve testability, reusability, and readability. Consider using a state machine library (e.g., xstate) if the regenerate/upload/reset flows become more complex.
  - Evidence: `READ-022`
- **[MEDIUM] No abstraction layer for external dependencies (Anthropic SDK, database)** (effort M) — The anthropic.ts module directly instantiates the Anthropic SDK client and makes API calls (READ-015). The lib/db.ts and extraction-store.ts modules directly use Drizzle ORM and the postgres driver. This tight coupling to external libraries makes it difficult to mock for testing, swap implementations (e.g., use a different LLM provider), or add cross-cutting concerns like retry logic or observability. The model-policy.ts file provides a thin policy layer (canUseAnthropic, resolveModel) but does not abstract the SDK itself.
  - Recommendation: Introduce adapter/facade interfaces for external dependencies. For example, define an interface like `interface LlmProvider { extract(docs): Promise<Extraction | null> }` and implement it with an AnthropicProvider class that wraps the SDK. Similarly, define a `interface DocumentStore { save(pack): Promise<void> }` for database operations. This will decouple the business logic from vendor-specific APIs and make the codebase more resilient to changes.
  - Evidence: `READ-015`, `READ-001`
- **[LOW] Zod schema duplication between anthropic.ts and briefing-schema.ts** (effort S) — The anthropic.ts file defines Zod schemas (citedSchema, extractionSchema, qaSchema, summarySchema) for validating AI responses (READ-015). The briefing-schema.ts file likely defines similar schemas for export requests. This duplication creates a maintenance burden: if the shape of a CitedItem or Extraction changes, both files must be updated. The schemas are not shared, so they can drift out of sync.
  - Recommendation: Consolidate all Zod schemas into a single lib/schemas.ts file and import them where needed. This will be the single source of truth for data validation and reduce the risk of inconsistency.
  - Evidence: `READ-015`
- **[INFO] Clean separation of concerns with well-defined module boundaries** (effort S) — The codebase demonstrates strong architectural discipline. The lib/ directory cleanly separates concerns: extraction.ts (deterministic parsing), anthropic.ts (AI integration), briefing.ts (orchestration), document-loader.ts (I/O), exports.ts (formatting), qa.ts (Q&A logic), and review.ts (user feedback). Each module has a single responsibility and imports are explicit and acyclic. The types.ts file provides a shared type vocabulary (BoardPack, Extraction, BoardBriefing, CitedItem, ActionItem) that enables loose coupling between layers. The Next.js App Router routes (app/api/) are thin adapters that delegate to lib functions rather than embedding business logic.
  - Recommendation: Maintain this modular structure as the codebase grows. Document the module dependency graph in the README to help new contributors understand the architecture.
  - Evidence: `READ-006`, `READ-015`, `READ-016`, `READ-017`, `READ-023`
- **[INFO] Framework choice (Next.js + React) is well-suited to the asset's scope and deployment model** (effort S) — The asset is a full-stack web application with a React UI, server-side API routes, and optional database persistence. Next.js App Router is an appropriate choice: it provides file-based routing, server components for data fetching, and seamless API route handling. The use of TypeScript throughout (2,524 lines, 100%) ensures type safety across the stack. The optional database and AI integrations (via environment variables) align with the 12-factor app pattern and allow the app to degrade gracefully when secrets are not configured. The tech stack (Next.js, React, Drizzle ORM, Zod) is modern, well-maintained, and widely adopted, reducing long-term maintenance risk.
  - Recommendation: Continue using this stack. Document the rationale for framework choices in the README to help future maintainers understand the design decisions.
  - Evidence: `ARC-001`, `ARC-002`, `ARC-003`, `READ-001`, `READ-002`

### Code quality & tech debt

- **[HIGH] Thin test coverage: 4 tests for 41 source files** (effort M) — The project has only 4 test files (anthropic.test.ts, briefing.test.ts, model-policy.test.ts, review.test.ts) covering 41 source files, yielding a 0.10 ratio. The test suite focuses on core library functions (Anthropic API integration, briefing generation, QA fallback) but provides no coverage for React components (11 files in components/), API routes (5 files in app/api/), or database/export utilities. The largest untested module is board-pack-workspace.tsx (210 lines), which orchestrates the entire UI state and handles file uploads, regeneration, and Q&A interactions. Components like ExportMenu.tsx (77 lines), ActionsTab.tsx (150 lines), and BriefingTab.tsx (152 lines) are also untested. This leaves critical user-facing logic and integration points vulnerable to regression.
  - Recommendation: Establish a minimum test coverage target of 60% for library code and 40% for components. Prioritize integration tests for the board-pack-workspace component and API routes (upload, export, QA). Use React Testing Library for component tests and add end-to-end tests for the upload → briefing → export workflow. This is a foundational quality gate for a production asset.
  - Evidence: `QUA-001`, `READ-012`, `READ-020`, `READ-027`
- **[MEDIUM] Large untested React component managing complex state** (effort M) — The board-pack-workspace.tsx component (210 lines) is the central orchestrator of the application, managing 11 pieces of state (pack, briefing, aiMode, activeTab, activeDocumentId, question, qaTurns, isAsking, isRegenerating, isUploaded, uploadStatus, reviews) and handling three async workflows (askQuestion, regenerate, uploadDocuments). It has no test coverage. The component's complexity and lack of tests create risk for state management bugs, race conditions in async handlers, and UI regressions when refactoring.
  - Recommendation: Write integration tests for board-pack-workspace using React Testing Library, covering: (1) initial render with demo data, (2) tab navigation, (3) file upload flow with validation, (4) Q&A question submission and response display, (5) briefing regeneration. Mock API calls and test state transitions. Consider extracting state management into a custom hook or reducer to improve testability.
  - Evidence: `READ-027`, `QUA-001`
- **[MEDIUM] API routes lack input validation tests** (effort M) — Five API routes (board-pack, export/markdown, export/pdf, qa, upload) handle user input and external API calls but have no test coverage. The qa route uses Zod schema validation (QuestionSchema), which is good, but there are no tests verifying error handling, malformed input rejection, or edge cases (e.g., empty file uploads, oversized payloads). The upload route accepts FormData with exactly 5 documents but this constraint is only enforced client-side in the component.
  - Recommendation: Add test coverage for each API route: test valid requests, invalid payloads, missing required fields, and error responses. For the upload route, add server-side validation to enforce the 5-document constraint. Use a test framework like supertest or MSW to mock HTTP requests.
  - Evidence: `READ-021`, `QUA-001`
- **[LOW] No linter or code formatter configured** (effort S) — The project has no ESLint, Prettier, or similar configuration. TypeScript strict mode is enabled (tsconfig.json shows strict: true), which provides some safety, but there is no automated enforcement of code style, import ordering, or common pitfalls (unused variables, missing null checks, etc.). This increases maintenance friction and makes code reviews more subjective.
  - Recommendation: Add ESLint with a standard config (e.g., eslint-config-next for Next.js projects) and Prettier for formatting. Integrate both into the build pipeline and pre-commit hooks. This is a low-effort hygiene improvement that will reduce review cycles and catch bugs early.
  - Evidence: `QUA-002`, `READ-026`
- **[INFO] Strong type safety and schema validation with Zod** (effort S) — The codebase makes effective use of TypeScript strict mode and Zod for runtime schema validation. All major data structures (BoardPack, Extraction, Briefing, QA responses) are validated against Zod schemas before use. The anthropic.ts module includes robust parseJson() function that safely extracts JSON from LLM output and validates it against schemas. This defensive approach reduces the risk of runtime errors from malformed API responses or user input.
  - Recommendation: Continue this pattern: ensure all external inputs (API responses, file uploads, user queries) are validated against Zod schemas before processing. Document the schema contracts in README or API docs for future maintainers.
  - Evidence: `READ-013`, `READ-026`
- **[INFO] Deterministic fallback mode enables testing without external API** (effort S) — The codebase includes a well-designed fallback mechanism: when ANTHROPIC_API_KEY is not set, the system operates in 'deterministic-demo' mode, using pre-extracted data from demo documents instead of calling the Anthropic API. This is evident in lib/anthropic.ts (canUseAnthropic() check) and lib/qa.ts (UNSUPPORTED_ANSWER fallback). The test suite leverages this to run integration tests without API credentials, and the briefing.test.ts verifies the fallback behavior explicitly.
  - Recommendation: Document this fallback mode in the README and leverage it in CI/CD to run tests without secrets. Consider adding a test mode flag to make the fallback behavior explicit and testable.
  - Evidence: `READ-012`, `READ-013`, `READ-020`

### Security

- **[MEDIUM] No automated dependency update mechanism** (effort S) — The project has 8 runtime dependencies (including @anthropic-ai/sdk, next, drizzle-orm, postgres, react, zod, and others) with no Dependabot or Renovate configuration to automate security updates. The package-lock.json is present but there is no CI pipeline (per TEAM-001) to enforce dependency checks on pull requests. This creates supply-chain risk: known vulnerabilities in transitive dependencies may not be detected or patched promptly.
  - Recommendation: Add a Dependabot or Renovate configuration file (dependabot.yml or renovate.json) to the repository root to enable automated dependency update PRs. Pair this with a CI pipeline that runs security audits (npm audit) on every commit. Prioritize updates for direct dependencies like @anthropic-ai/sdk and postgres.
  - Evidence: `SEC-001`, `READ-003`, `TEAM-001`
- **[MEDIUM] File upload endpoint lacks size and type validation** (effort M) — The POST /api/upload route (app/api/upload/route.ts) accepts file uploads with minimal validation: it checks that exactly 5 files are provided and that each has size > 0, but does not validate file type (MIME type), maximum file size per document, or total payload size. The parseMarkdownDocument function is called on all files without checking if they are actually Markdown. This could allow an attacker to upload large binary files or non-Markdown content, potentially causing denial of service or unexpected behavior.
  - Recommendation: Add file type validation (check MIME type and/or file extension for .md). Enforce a maximum file size per document (e.g., 10 MB) and total payload size (e.g., 50 MB). Validate that uploaded content is valid Markdown before processing. Consider using a library like file-type to verify MIME types. Add rate limiting to the upload endpoint to prevent abuse.
  - Evidence: `READ-018`
- **[LOW] API key passed directly to SDK constructor without validation** (effort S) — In lib/anthropic.ts line 58, the Anthropic API key is read from process.env.ANTHROPIC_API_KEY and passed directly to the SDK constructor without any validation or sanitization. While the key is correctly sourced from environment variables (not hardcoded), there is no check to ensure the key format is valid before use, and no explicit handling of key rotation or expiry. The model allowlist enforcement in lib/model-policy.ts is well-designed, but the API key itself lacks defensive checks.
  - Recommendation: Add a validation function to check that ANTHROPIC_API_KEY matches expected format (e.g., non-empty string, length bounds) before passing to the Anthropic constructor. Consider adding a wrapper that logs key usage (without exposing the key itself) for audit trails. Document the expected key format in the README.
  - Evidence: `READ-009`, `READ-011`
- **[LOW] Database connection string stored in environment variable without encryption** (effort S) — The DATABASE_URL environment variable (lib/db.ts) contains the full Postgres connection string, including credentials. While this is a standard 12-factor pattern and the code correctly reads it from the environment rather than hardcoding it, there is no encryption or masking of the connection string in logs or error messages. The postgres client is instantiated with prepare: false, which is appropriate for serverless, but there is no connection pooling configuration or timeout limits visible.
  - Recommendation: Ensure DATABASE_URL is never logged or exposed in error messages. If deploying to Vercel or similar, use the platform's secret management (not .env.local in version control). Consider adding connection timeout and idle timeout settings to the postgres client configuration. Document that DATABASE_URL should use a pooled connection string for serverless environments (as noted in README but not enforced in code).
  - Evidence: `READ-010`, `CLD-003`
- **[LOW] No input sanitization for document content before AI processing** (effort M) — The lib/anthropic.ts extraction and summarization functions accept document content directly from user input (uploaded files or seeded fixtures) and pass it to the Anthropic API without sanitization. While the Zod schemas validate the JSON response structure, there is no validation of the input document content itself. This could allow prompt injection if a malicious document is crafted to manipulate the AI model's behavior, though the grounding-based design (requiring citations) mitigates the impact.
  - Recommendation: Add input validation to sanitize or escape document content before sending to the Anthropic API. Consider truncating very long sections or documents to prevent token exhaustion attacks. Document the prompt injection risk and the mitigation (grounding requirement) in the AI_POLICY.md.
  - Evidence: `READ-009`
- **[LOW] No authentication or authorization on API endpoints** (effort M) — The API routes (upload, export, qa, board-pack) have no authentication or authorization checks. Any user with access to the deployed application can call these endpoints. This is acceptable for a demo or internal tool running on a private network, but if deployed publicly, it would allow unauthorized access to board pack data and AI processing. The README notes the app is designed for internal corporate use, but there is no code-level enforcement of this.
  - Recommendation: If this asset is deployed to a public or semi-public environment, add authentication (e.g., API key, OAuth, or session-based) to all API routes. At minimum, add a comment in each route handler documenting the assumption that the app runs in a trusted environment. Consider adding a middleware that checks for a shared secret or API key if public deployment is planned.
  - Evidence: `READ-018`, `READ-004`
- **[INFO] Model allowlist enforcement is well-designed** (effort S) — The lib/model-policy.ts module enforces a strict allowlist: only claude-haiku-4-5-20251001 is permitted, and any attempt to use a different model throws an error. This is called in canUseAnthropic() before instantiating the Anthropic client, preventing model injection or drift. The design is defensive and aligns with the stated AI policy in the README.
  - Recommendation: Continue to enforce this pattern. Consider adding a test that verifies an error is thrown if ANTHROPIC_MODEL is set to an unsupported value (this is already tested in tests/model-policy.test.ts, which is a strength).
  - Evidence: `READ-011`, `READ-004`

### Cloud readiness

- **[HIGH] No containerisation or deployment configuration** (effort M) — The asset is a Next.js full-stack application with a PostgreSQL database dependency, but lacks a Dockerfile, docker-compose file, or any infrastructure-as-code (Terraform, CloudFormation, etc.). While the README mentions Vercel deployment as the reference path, there is no container definition for self-hosted or multi-cloud deployment. This limits operational flexibility and increases deployment friction for environments outside Vercel.
  - Recommendation: Add a Dockerfile with multi-stage build (dev and production stages) and a docker-compose.yml for local development with PostgreSQL. Include a .dockerignore file. For production, provide Terraform or CloudFormation templates for AWS ECS/Fargate or equivalent, or a Helm chart for Kubernetes. This will enable cost-effective self-hosted deployment and reduce vendor lock-in.
  - Evidence: `CLD-001`, `CLD-002`, `READ-030`
- **[MEDIUM] 12-factor configuration partially implemented; secrets not externalized** (effort S) — The application reads DATABASE_URL and ANTHROPIC_API_KEY from environment variables (READ-033, READ-034), following 12-factor principles. However, the .env.example file (READ-029) shows only three variables with no documentation of required vs. optional, defaults, or validation. The code gracefully degrades when secrets are absent (e.g., deterministic fallback when ANTHROPIC_API_KEY is unset), but there is no runtime validation or clear error messaging if DATABASE_URL is malformed. No secrets management integration (AWS Secrets Manager, HashiCorp Vault, etc.) is documented.
  - Recommendation: Enhance .env.example with descriptions, required/optional flags, and example values. Add runtime validation in lib/db.ts and lib/anthropic.ts to fail fast with clear error messages if DATABASE_URL is invalid. Document integration with cloud secrets managers (AWS Secrets Manager, Azure Key Vault, Google Secret Manager) in the deployment guide. Consider a config validation schema (e.g., using Zod) at application startup.
  - Evidence: `CLD-003`, `READ-029`, `READ-033`, `READ-034`
- **[MEDIUM] No observability or logging infrastructure** (effort M) — The codebase contains minimal logging: only one console.warn in lib/anthropic.ts (READ-034) when the Anthropic API call fails. There is no structured logging, no metrics collection, no tracing, and no health check endpoints. For a production application with external API dependencies (Anthropic, PostgreSQL), this makes debugging, monitoring, and alerting in cloud environments difficult. The application will be opaque to observability platforms (DataDog, New Relic, CloudWatch, etc.).
  - Recommendation: Integrate a structured logging library (e.g., pino or winston) with JSON output for cloud log aggregation. Add basic metrics (request latency, API call success/failure, database query time) using a library like prometheus-client. Implement a /health endpoint for Kubernetes liveness/readiness probes. Document how to configure log levels and export metrics to common platforms. This is essential for production observability.
  - Evidence: `READ-034`, `ARC-003`
- **[LOW] Node version constraint is modern but not pinned in deployment** (effort S) — package.json specifies Node >=20 (READ-028), which is appropriate for modern TypeScript and Next.js. However, there is no .nvmrc file, no Dockerfile pinning a specific Node version, and no CI configuration to test against a specific version. This creates drift risk: the application may behave differently across environments if Node minor/patch versions diverge.
  - Recommendation: Add a .nvmrc file pinning to a specific LTS version (e.g., 20.18.0). In the Dockerfile, use a specific Node image tag (e.g., node:20.18.0-alpine) rather than node:20. This ensures reproducible builds and reduces environment-specific bugs.
  - Evidence: `READ-028`, `TEAM-001`
- **[INFO] Graceful degradation and optional dependencies are well-designed** (effort S) — The application demonstrates strong cloud-native patterns: it runs without DATABASE_URL (using seeded fixtures) and without ANTHROPIC_API_KEY (using deterministic fallback), with transparent mode badges showing which path was taken (READ-030, READ-034). This allows zero-secret deployment to Vercel or any container platform, and enables cost-effective operation without external API calls. The architecture is resilient to transient failures and supports graceful degradation.
  - Recommendation: Document this degradation strategy prominently in deployment guides. Consider adding feature flags or a configuration option to force deterministic mode for cost control. This is a strength that reduces operational risk and deployment complexity.
  - Evidence: `READ-030`, `READ-034`, `READ-028`

### Team & process

- **[CRITICAL] Critical bus factor: single contributor with zero recent activity** (effort M) — The repository has 4 commits by 1 contributor, with the last commit 110 days ago and no activity in the last 90 days. The top contributor authored 100% of commits. This creates extreme key-person risk: there is no backup knowledge holder, no peer review history, and no evidence of ongoing maintenance or support. For a production asset managing corporate board documents, this represents a material operational risk.
  - Recommendation: Before close, establish a second engineer with commit history to the codebase. Conduct a knowledge transfer session covering deployment, database migrations, API integrations, and incident response. Document runbooks for common operational tasks (database recovery, API key rotation, deployment rollback). Consider establishing a maintenance SLA.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[HIGH] No CI/CD pipeline configured** (effort S) — The repository has no GitHub Actions, GitLab CI, CircleCI, or other CI/CD configuration. There is no automated testing, type-checking, or build validation on commits or pull requests. The package.json includes test and typecheck scripts, but they are not enforced. This means code can be merged without verification, increasing the risk of regressions and deployment failures.
  - Recommendation: Implement a CI pipeline (GitHub Actions recommended for simplicity) that runs on every commit and PR: execute `npm test`, `npm run typecheck`, and `npm run build`. Require pipeline success before merging. Start with a basic workflow; can be enhanced post-close.
  - Evidence: `TEAM-001`, `READ-037`
- **[MEDIUM] Thin test coverage with no enforcement** (effort M) — The codebase has 4 test files covering 41 source files (0.10 ratio). Tests exist for core logic (anthropic, briefing, model-policy, review) but there is no linter, formatter, or coverage threshold configured. Without CI enforcement, test execution is optional and coverage can degrade silently. For an asset handling sensitive corporate documents and AI integration, this is a material quality risk.
  - Recommendation: Add coverage thresholds to vitest.config.ts (e.g., 60% line coverage minimum) and enforce in CI. Prioritize tests for extraction logic, Q&A grounding, and export functions. Add a linter (ESLint) and formatter (Prettier) with pre-commit hooks to catch style and common errors early.
  - Evidence: `QUA-001`, `QUA-002`, `READ-037`
- **[MEDIUM] No automated dependency updates** (effort S) — The repository has no Dependabot or Renovate configuration. With 8 runtime and 6 dev dependencies (including Next.js, React, Anthropic SDK, and Drizzle ORM), dependency updates are manual and likely infrequent given the 110-day inactivity. This increases exposure to security patches and compatibility issues. The single contributor model makes this worse: updates may be delayed or missed entirely.
  - Recommendation: Enable Dependabot (GitHub) or Renovate with auto-merge for patch updates and grouped minor/major updates. Pair with CI to catch breaking changes. This reduces manual toil and keeps dependencies current without requiring active developer time.
  - Evidence: `SEC-001`, `TEAM-003`, `ARC-002`
- **[INFO] Comprehensive documentation and clear onboarding path** (effort S) — The README is well-structured (134 lines) with clear setup instructions, feature overview, tech stack, and deployment guidance. The project includes supplementary docs (AI_POLICY.md, PROJECT_SPEC.md, DATA_MODEL.md, EVALS.md, ROADMAP.md) that explain design decisions and responsible AI constraints. Scripts are documented in a table format. The project structure is clearly laid out. This is a strength: a new engineer can onboard quickly and understand the codebase's intent and constraints.
  - Recommendation: Maintain this documentation standard. As the team grows, keep docs in sync with code changes. Consider adding a CONTRIBUTING.md with branch naming, commit message conventions, and PR review checklist.
  - Evidence: `TEAM-002`, `READ-031`, `READ-037`

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
- `READ-001` Inspected package.json — package.json
- `READ-002` Inspected README.md — README.md
- `READ-003` Inspected package.json — package.json
- `READ-004` Inspected README.md — README.md
- `READ-005` Code search (17-char pattern): 1 matches — vitest.config.ts
- `READ-006` Inspected lib/types.ts — lib/types.ts
- `READ-007` Inspected db/schema.ts — db/schema.ts
- `READ-008` Code search (15-char pattern): 50 matches — .gitignore, app/api/board-pack/route.ts, app/api/export/markdown/route.ts, app/api/export/pdf/route.ts, app/api/qa/route.ts
- `READ-009` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-010` Inspected lib/db.ts — lib/db.ts
- `READ-011` Inspected lib/model-policy.ts — lib/model-policy.ts
- `READ-012` Inspected tests/anthropic.test.ts — tests/anthropic.test.ts
- `READ-013` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-014` Inspected package.json — package.json
- `READ-015` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-016` Inspected lib/briefing.ts — lib/briefing.ts
- `READ-017` Inspected lib/extraction.ts — lib/extraction.ts
- `READ-018` Inspected app/api/upload/route.ts — app/api/upload/route.ts
- `READ-019` Code search (38-char pattern): 30 matches — .env.example, app/globals.css, components/board-pack-workspace.tsx, components/ExportMenu.tsx, components/tabs/ActionsTab.tsx
- `READ-020` Inspected tests/briefing.test.ts — tests/briefing.test.ts
- `READ-021` Code search (46-char pattern): 50 matches — app/api/board-pack/route.ts, app/api/export/markdown/route.ts, app/api/export/pdf/route.ts, app/api/qa/route.ts, app/api/upload/route.ts
- `READ-022` Inspected components/board-pack-workspace.tsx — components/board-pack-workspace.tsx
- `READ-023` Code search (52-char pattern): 40 matches — .gitignore, app/api/board-pack/route.ts, app/api/export/markdown/route.ts, app/api/export/pdf/route.ts, app/api/qa/route.ts
- `READ-024` Inspected .env.example — .env.example
- `READ-025` Code search (48-char pattern): 20 matches — .env.example, lib/anthropic.ts, lib/document-loader.ts, lib/model-policy.ts, README.md
- `READ-026` Inspected tsconfig.json — tsconfig.json
- `READ-027` Inspected components/board-pack-workspace.tsx — components/board-pack-workspace.tsx
- `READ-028` Inspected package.json — package.json
- `READ-029` Inspected .env.example — .env.example
- `READ-030` Inspected README.md — README.md
- `READ-031` Inspected README.md — README.md
- `READ-032` Code search (49-char pattern): 20 matches — AI_POLICY.md, app/globals.css, app/layout.tsx, components/AppHeader.tsx, components/board-pack-workspace.tsx
- `READ-033` Inspected lib/db.ts — lib/db.ts
- `READ-034` Inspected lib/anthropic.ts — lib/anthropic.ts
- `READ-035` Code search (35-char pattern): 30 matches — .env.example, app/api/qa/route.ts, components/ui/ModeBadge.tsx, lib/anthropic.ts, lib/briefing-schema.ts
- `READ-036` Code search (54-char pattern): 8 matches — app/layout.tsx, DATA_MODEL.md, lib/briefing.ts, PROJECT_SPEC.md, README.md
- `READ-037` Inspected package.json — package.json

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened; 0 model findings were discarded for citing evidence that does not exist. Critical and high scanner flags cannot be removed by the model. Cost: $0.2253 (180,968 tokens).
