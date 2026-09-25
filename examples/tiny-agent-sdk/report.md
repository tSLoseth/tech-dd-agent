# Technology due diligence — https://github.com/tSLoseth/tiny-agent-sdk

_Generated 2026-09-25T18:25:23.012Z · mode: full · model: claude-haiku-4-5-20251001 · 25 files, 1,094 lines of code_

**Overall: 69/100 — Red**

> Solid learning SDK with strong architecture but critical team and process gaps that must be resolved before close: single-person maintenance, no tests, and no CI/CD pipeline create unacceptable operational risk.

## Red flags

- Bus factor of one with no recent activity—clarify intended role and establish transition plan with original author before close
- No automated test suite for a public API surface—high risk for regressions and maintenance
- No CI/CD pipeline or quality gates—no safety net for future development or contributor onboarding
- Custom path traversal validation—replace with battle-tested library and add comprehensive edge-case tests

## Value-creation levers

- Add test suite (>70% coverage) covering agent loop, tool dispatch, and permission logic—enables safe extension and reduces maintenance burden
- Implement CI/CD pipeline with automated builds and tests—establishes quality baseline and makes onboarding new maintainers feasible
- Extract agent runner abstraction and define provider-agnostic message types—decouples from Anthropic SDK and enables multi-provider support
- Add structured logging and observability hooks—critical for production deployment and debugging in cloud environments
- Create DEVELOPMENT.md and operational runbook—reduces onboarding time and documents implicit conventions

## 100-day plan

1. Days 1–14: Conduct knowledge transfer with original author; document critical design decisions, tool registration patterns, and hook/policy system. Establish single point of contact for questions.
2. Days 15–30: Build test suite for core agent loop (runAgent/runAgentStream), tool dispatch, and permission verdicts using vitest; target >70% coverage of src/.
3. Days 31–45: Set up GitHub Actions CI pipeline to run build and tests on every commit; add ESLint and Prettier for code quality gates.
4. Days 46–60: Replace custom path traversal validation with path-is-inside library; add unit tests for Windows/Unix edge cases (../, symlinks, absolute paths).
5. Days 61–75: Add structured logging (pino or winston) to agent loop; emit start/end and tool execution events with context for debuggability.
6. Days 76–100: Write DEVELOPMENT.md covering setup, examples, debugging, code style, and how to add tools/hooks; enable Dependabot for automated dependency updates; document secrets handling and production transition path.

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 82 | Green | 7 |
| Code quality & tech debt | 63 | Amber | 7 |
| Security | 76 | Amber | 7 |
| Cloud readiness | 80 | Green | 5 |
| Team & process | 44 | Red | 4 |

## Findings

### Architecture & stack

- **[MEDIUM] Runtime tool discovery by string name creates type-safety gap** (effort M) — Tools are stored in arrays and discovered at runtime by string name (dispatchTool in tools.ts). A typo in a tool name, a missing tool, or a mismatch between what the model requests and what is available will only be caught at runtime, after the model has already been called. There is no compile-time or early-validation check that the tool set is complete or that tool names are consistent across the codebase.
  - Recommendation: Consider a tool registry pattern: define tools as a const object keyed by name (e.g. `const tools = { read_file: {...}, write_file: {...} }`) and derive the array from it. This makes tool names part of the type system and catches typos at compile time. Alternatively, use a discriminated union type for tool calls to ensure the model's requests are type-checked.
  - Evidence: `READ-008`, `READ-007`
- **[MEDIUM] Tight coupling to Anthropic SDK types limits provider portability** (effort M) — The codebase exposes Anthropic SDK types throughout: RunAgentOptions takes `Anthropic.MessageParam[]`, toAnthropicTools returns `Anthropic.Tool[]`, and Session stores `Anthropic.MessageParam[]` directly. Swapping to a different LLM provider (OpenAI, Gemini, etc.) would require changes across agent.ts, session.ts, tools.ts, and the CLI. The README explicitly states this is not a multi-provider abstraction, but the tight coupling makes it harder to extend or adapt.
  - Recommendation: Define a thin abstraction layer for message and tool types (e.g. `type Message = { role: 'user' | 'assistant'; content: string | ToolCall[] }`) and map to/from Anthropic types at the boundary. This is a medium-effort refactor but would make the core logic provider-agnostic and easier to test.
  - Evidence: `READ-007`, `READ-008`, `READ-009`, `READ-002`
- **[LOW] No extension mechanism for tool composition or middleware** (effort M) — Tools are passed as flat arrays; there is no registry, plugin system, or middleware pattern for composing, wrapping, or dynamically loading tools. Adding a feature like tool caching, retry logic, or cost tracking would require modifying the core agent loop or tool dispatch logic. The hook system (PreToolUse, PostToolUse) provides some extensibility for observation and blocking, but not for transformation or composition.
  - Recommendation: For a learning project, this is acceptable. If the codebase grows to support plugins or dynamic tool loading, introduce a ToolRegistry class and a ToolMiddleware pattern (similar to Express middleware) to allow wrapping and composing tools without modifying the core loop.
  - Evidence: `READ-008`, `READ-007`
- **[LOW] Session state is in-memory only; persistence is synchronous and non-transactional** (effort M) — Session state is the messages array, held in memory. The save/load methods use synchronous file I/O (writeFileSync, readFileSync). There is no async persistence, no transaction semantics, and no conflict resolution for concurrent sessions. If two sessions try to load and save the same file, the last write wins. For a learning project or single-user CLI, this is fine; for a service, it would be a bottleneck.
  - Recommendation: For the current scope (learning project, CLI tool), no change is needed. If this evolves into a service, introduce an async PersistenceLayer interface (load/save/delete) and support pluggable backends (file, database, cloud storage). Add optimistic locking or version numbers to detect concurrent modifications.
  - Evidence: `READ-009`
- **[LOW] No error recovery, retry logic, or graceful degradation for API failures** (effort M) — The agent loop calls the Anthropic API directly with no retry logic, exponential backoff, or circuit breaker. If the API is temporarily unavailable or rate-limited, the call fails immediately and the error is fed back to the model. There is no mechanism to pause, retry, or gracefully degrade. For a learning project, this is acceptable; for production use, it would be a gap.
  - Recommendation: For the current scope, no change is needed. If this becomes a service, wrap the API call in a retry utility (e.g. exponential backoff with jitter) and add a circuit breaker to prevent cascading failures. Consider adding a timeout and a fallback response.
  - Evidence: `READ-007`
- **[INFO] Excellent modular architecture with clear separation of concerns** (effort S) — The codebase demonstrates strong architectural discipline: each concept (agent loop, tools, session state, permissions, hooks, subagents) is isolated in its own small, readable file with a single responsibility. The agent loop is implemented once as an async generator (runAgentStream) and reused by a blocking front door (runAgent), eliminating duplication. Tool validation uses zod for both schema definition and runtime safety. The permission policy is a pure function, and hooks are injected as arrays, making the system composable and testable.
  - Recommendation: This is a strength. Maintain this modularity as the codebase grows; resist the temptation to merge files or add cross-cutting logic outside the hook/policy system.
  - Evidence: `READ-007`, `READ-008`, `READ-009`, `READ-016`, `READ-017`, `READ-021`, `READ-002`
- **[INFO] Clear design boundaries and explicit non-goals support maintainability** (effort S) — The README explicitly lists what the SDK is NOT (multi-provider, durable persistence, execution-trace store, HTTP service, approval queue, context compaction, parallel fan-out, npm packaging). This clarity of scope makes the codebase easier to understand and maintain. The design notes explain the key decisions (one loop, two front doors; errors fed back; defense in depth; subagents as Sessions). This is a strength for a learning project.
  - Recommendation: Maintain this clarity as the codebase evolves. If new features are added, update the design boundaries section to reflect the new scope. This helps future maintainers understand what is in and out of scope.
  - Evidence: `READ-002`

### Code quality & tech debt

- **[HIGH] No automated tests in a learning SDK with public API surface** (effort M) — The repository contains 15 source files (1,094 lines of TypeScript) with zero test files. The codebase exports a public API (runAgent, runAgentStream, Tool, Session, etc.) documented in README.md and demonstrated across 6 example files. Without tests, regressions in core abstractions (the agent loop, tool dispatch, permission policy, streaming) cannot be caught. For a learning project intended to be read and understood, tests would also serve as executable documentation of expected behavior.
  - Recommendation: Add a test suite covering the core loop (runAgent/runAgentStream), tool dispatch, permission policy verdicts, and hook execution. Start with unit tests for the agent loop and permission logic; integration tests for the examples are lower priority. Use vitest or jest; aim for >70% coverage of src/.
  - Evidence: `QUA-001`, `READ-005`, `READ-006`, `READ-013`
- **[MEDIUM] Tight coupling between CLI and core agent logic** (effort M) — The CLI (src/cli.ts, 153 lines) directly instantiates Session, manages the REPL loop, and handles permissions/hooks inline. This couples the command-line interface to the SDK's core abstractions, making it harder to reuse the agent loop in other contexts (e.g., HTTP service, batch runner) without duplicating logic. The agent loop itself (src/agent.ts) is well-factored, but the CLI layer mixes concerns.
  - Recommendation: Extract a thin 'agent runner' abstraction that encapsulates Session lifecycle, REPL state, and hook/policy setup. The CLI should delegate to this runner, not manage it directly. This will make the SDK easier to embed in other frontends.
  - Evidence: `READ-013`
- **[MEDIUM] Minimal error handling and no structured logging** (effort M) — Error handling is sparse: tool execution failures are fed back to the model as error results (good for agent self-correction), but unexpected errors (e.g., API failures, permission policy exceptions) are not caught or logged. The optional `log` callback is a string-based progress reporter, not a structured logger. For a learning project this is acceptable, but it limits observability and makes debugging harder.
  - Recommendation: Add try-catch blocks around API calls and tool dispatch. Introduce a simple structured logger (or accept a logger interface in RunAgentOptions) to emit events (start, end, error, permission-denied) with context. This will improve debuggability without adding heavy dependencies.
  - Evidence: `READ-013`
- **[MEDIUM] Inactive repository with single-person bus factor** (effort M) — The repository has 3 commits by 1 contributor since June 2026, with 0 commits in the last 90 days (last commit 116 days ago). The README explicitly states this is a learning project not published to npm, but the lack of activity and single-person authorship create risk if the asset is to be maintained or extended post-acquisition. There is no CI pipeline (TEAM-001) to catch regressions if new contributors join.
  - Recommendation: If this asset is to be maintained, establish a CI pipeline (GitHub Actions or similar) to run tests and linting on every commit. Document the development setup in CONTRIBUTING.md. Plan for knowledge transfer to the acquiring team; the current author should pair with new maintainers on at least one feature or bug fix.
  - Evidence: `TEAM-003`, `TEAM-004`, `TEAM-001`
- **[LOW] No linter or code formatter configured** (effort S) — The repository has no ESLint, Prettier, or similar configuration. TypeScript strict mode is enabled (tsconfig.json), which catches type errors, but style consistency, unused variables, and common pitfalls are not enforced. For a learning project meant to be read, this is a minor gap; for a production SDK or team collaboration, it would be higher priority.
  - Recommendation: Add ESLint with a standard config (e.g., eslint-config-prettier) and Prettier. Include in the build script and CI (once added). This is a low-effort hygiene win.
  - Evidence: `QUA-002`, `READ-014`
- **[LOW] No dependency update automation** (effort S) — The project has 3 runtime dependencies (@anthropic-ai/sdk, zod, zod-to-json-schema) and 3 dev dependencies, but no Dependabot or Renovate configuration. The Anthropic SDK is pinned to ^0.32.0, which will accept minor/patch updates but not major versions. For a learning project with infrequent updates (last commit 116 days ago), this is low risk, but it means security patches may be missed.
  - Recommendation: Add a Dependabot or Renovate config to automate dependency updates. For a learning project, weekly or monthly checks are sufficient. This is a low-effort security hygiene step.
  - Evidence: `SEC-001`, `READ-006`
- **[INFO] Well-structured core abstractions and clear separation of concerns** (effort S) — The SDK demonstrates strong architectural discipline: the agent loop (runAgentStream) is a single, reusable async generator; tools are defined via Zod schemas and dispatched through a type-safe interface; permissions and hooks are pluggable policies; sessions encapsulate multi-turn state; subagents reuse the loop with isolated context. Each concept lives in its own file (agent.ts, tools.ts, permissions.ts, hooks.ts, session.ts, subagent.ts) with clear responsibilities. The README explicitly documents design boundaries and non-goals, showing intentional scope.
  - Recommendation: Maintain this discipline as the codebase grows. The modular structure is a strength; document it in CONTRIBUTING.md to guide future contributors.
  - Evidence: `READ-005`, `READ-013`

### Security

- **[MEDIUM] No automated dependency updates configured** (effort S) — The project has no Dependabot, Renovate, or equivalent automation to detect and update vulnerable dependencies. With 3 runtime dependencies (@anthropic-ai/sdk, zod, zod-to-json-schema) and 3 dev dependencies, the project relies on manual review. The Anthropic SDK in particular is a third-party integration that may receive security patches.
  - Recommendation: Enable Dependabot (GitHub native) or Renovate to automatically open pull requests for dependency updates. Configure to auto-merge patch-level updates after CI passes, and require manual review for minor/major versions.
  - Evidence: `SEC-001`, `READ-003`
- **[MEDIUM] Path traversal defense is layered but relies on custom validation** (effort M) — The permissions layer (src/permissions.ts) enforces workspace-root scoping for file operations, and the README notes 'defense in depth' with both policy and tool-level checks. However, the path validation logic is custom-built (isInside function in src/paths.ts) rather than using a battle-tested library. Custom path logic is a common source of traversal bugs, especially across OS boundaries (Windows vs. Unix path separators).
  - Recommendation: Replace the custom isInside() implementation with a well-tested library such as `path-is-inside` or Node's built-in `path.resolve()` + string comparison. Add unit tests for edge cases: `../`, `..\`, symlinks, and absolute paths. Verify behavior on both Windows and Unix.
  - Evidence: `READ-012`, `READ-004`
- **[MEDIUM] No secrets scanning or pre-commit hooks to prevent accidental key commits** (effort S) — While .gitignore excludes .env files, there is no pre-commit hook (e.g., via husky or git-secrets) to catch accidental commits of API keys or other secrets. A developer could bypass .gitignore or commit a secret to a different file by mistake.
  - Recommendation: Add a pre-commit hook using `husky` and `lint-staged` to run `git-secrets` or `truffleHog` before commits. Alternatively, configure GitHub's native secret scanning. Document the setup in CONTRIBUTING.md.
  - Evidence: `READ-023`, `TEAM-001`
- **[LOW] Secrets handling is well-designed but .env file not encrypted** (effort S) — The project correctly avoids hardcoding the Anthropic API key and uses environment variables via a custom .env loader (src/env.ts). The .gitignore properly excludes .env and .env.* files, and documentation warns against committing real keys. However, the .env file itself is stored in plaintext on disk with no encryption at rest, which is acceptable for a learning project but would be a concern in production.
  - Recommendation: For this learning project, the current approach is appropriate. If deployed to production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault, or similar) instead of .env files. Document this transition path in the README.
  - Evidence: `READ-010`, `READ-011`, `READ-020`, `READ-023`
- **[LOW] No supply-chain risk mitigation for npm dependencies** (effort S) — The project uses npm with a package-lock.json but has no npm audit automation, no lockfile verification in CI, and no policy for handling transitive dependencies. The Anthropic SDK is a critical dependency for API communication, and any compromise could expose API keys or intercept model responses.
  - Recommendation: Add `npm audit` to the build pipeline (once CI is set up). Consider using npm's `--audit-level=moderate` to fail on moderate or higher vulnerabilities. Periodically review transitive dependencies with `npm ls` and document any known risks. For production use, consider npm provenance verification.
  - Evidence: `READ-003`, `ARC-002`
- **[LOW] Environment variable loading tolerates quoted keys, increasing parsing risk** (effort S) — The custom .env loader (src/env.ts) strips wrapping quotes from both keys and values to handle workspace conventions. While this is pragmatic for a learning project, it introduces a non-standard parsing behavior that could mask typos (e.g., `"ANTHROPIC_API_KEY"=value` would be stored as `ANTHROPIC_API_KEY` instead of failing). This increases the risk of misconfiguration in production.
  - Recommendation: Document this behavior clearly in code comments and README. For production, migrate to Node's native `--env-file` flag (Node 20.10+) or the `dotenv` package, which follow standard conventions. Add validation to ensure ANTHROPIC_API_KEY is set and non-empty before the SDK is initialized.
  - Evidence: `READ-010`
- **[INFO] Minimal but sound permission model for tool execution** (effort S) — The permission system (src/permissions.ts) implements a three-tier decision model (allow/deny/ask) that mirrors Claude Code's approach. File operations are scoped to a workspace root, and arbitrary commands require human confirmation. This is a well-reasoned design for an agent SDK that executes code on behalf of a user.
  - Recommendation: This design is a strength. As the project matures, consider documenting the threat model and permission policy in a SECURITY.md file for users who may integrate this SDK into larger systems.
  - Evidence: `READ-012`, `READ-004`

### Cloud readiness

- **[MEDIUM] No containerisation or deployment infrastructure** (effort M) — The asset is a learning-focused TypeScript SDK with no Dockerfile, Docker Compose, or any infrastructure-as-code (Terraform, CloudFormation, Helm, etc.). While the README explicitly states this is not a production runtime and lists HTTP/service API as a non-goal, deployment to cloud environments would require building containerisation and infrastructure from scratch. For a library or CLI tool of this size (1,094 lines), this is expected, but it means any buyer planning to operationalise it as a service would face non-trivial effort.
  - Recommendation: If the asset is to be deployed as a service (not just consumed as a library), create a Dockerfile with Node 20+ base, multi-stage build for TypeScript compilation, and a docker-compose.yml for local development. Add a basic Terraform or CloudFormation template for cloud deployment. Effort is low-to-medium for a simple service wrapper.
  - Evidence: `CLD-001`, `CLD-002`, `READ-025`
- **[MEDIUM] No observability or logging infrastructure** (effort M) — The codebase has no structured logging, metrics, or tracing. The PostToolUse hook (mentioned in README as a lightweight audit stand-in) is present but there is no integration with observability platforms (CloudWatch, Datadog, Prometheus, etc.). For a learning project this is acceptable, but operationalising this as a service would require adding logging, error tracking, and performance monitoring.
  - Recommendation: Add structured logging (e.g., pino or winston) with JSON output for cloud-native environments. Instrument the agent loop (src/agent.ts) to emit start/end events and tool execution metrics. Consider adding OpenTelemetry for distributed tracing if subagent delegation is used in production.
  - Evidence: `READ-025`, `ARC-001`
- **[MEDIUM] No health checks or graceful shutdown handling** (effort S) — The CLI (src/cli.ts) and examples are designed for interactive or one-shot execution. There is no HTTP health endpoint, readiness probe, or graceful shutdown handler. If this asset is wrapped as a service, Kubernetes or container orchestrators would have no way to determine liveness or drain connections cleanly during rolling updates.
  - Recommendation: If deploying as a service, add a simple HTTP health endpoint (e.g., GET /health returning 200 OK) and implement SIGTERM handling to finish in-flight agent runs before exiting. For Kubernetes, define liveness and readiness probes in the deployment manifest.
  - Evidence: `READ-025`, `ARC-001`
- **[LOW] 12-factor configuration partially implemented** (effort S) — The asset reads ANTHROPIC_API_KEY from environment variables (via src/env.ts), following 12-factor principles. However, the custom .env loader (READ-029) is hand-rolled to avoid dependencies, which is pragmatic for a learning project but adds maintenance burden. The loader walks up the directory tree to find .env, which could cause unexpected behaviour in monorepo or containerised contexts where the working directory is not the project root.
  - Recommendation: For production use, consider adopting the standard `dotenv` package or Node's built-in `--env-file` flag (Node 20.10+). If hand-rolling is preferred, document the directory-walk behaviour and add a test to ensure it works correctly in containerised environments where cwd may differ from project root.
  - Evidence: `CLD-003`, `READ-026`, `READ-029`
- **[INFO] Minimal runtime dependencies and clean build output** (effort S) — The asset has only 3 runtime dependencies (@anthropic-ai/sdk, zod, zod-to-json-schema) and 3 dev dependencies, with a clean TypeScript build configuration (ES2022 target, Node16 module resolution). The package.json declares `"type": "module"` for ESM, and tsconfig.json outputs to `dist/` with no source maps or declarations, keeping the deployment footprint small. This is well-suited for containerisation and cloud deployment.
  - Recommendation: Maintain this lean dependency profile. When containerising, use a Node 20 slim base image and multi-stage build to exclude devDependencies from the final image. The small footprint will keep container image size and cold-start latency low.
  - Evidence: `READ-024`, `READ-030`, `ARC-002`

### Team & process

- **[CRITICAL] Critical bus factor: single contributor, no recent activity** (effort M) — The repository has only 1 contributor who authored 100% of the 3 commits, with the last commit 116 days ago and zero activity in the last 90 days. This creates extreme key-person risk: there is no backup knowledge holder, no code review discipline, and no active development pipeline. For a learning project this may be acceptable, but if this asset is intended for ongoing use or maintenance post-acquisition, the lack of team depth and recent activity signals abandonment risk.
  - Recommendation: Before close, clarify the intended role of this asset: if it is to be maintained or extended, establish a transition plan with the original author to document critical decisions, onboard a second maintainer, and establish a regular commit cadence. If it is a reference implementation or learning tool only, document that explicitly and set expectations accordingly.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[HIGH] No CI/CD pipeline or automated quality gates** (effort M) — There is no CI configuration (GitHub Actions, GitLab CI, or equivalent) to run builds, tests, or linting on commits. Combined with the absence of automated tests (QUA-001), this means code changes have no automated validation before merge. For a TypeScript project with 1,094 lines of code and external dependencies, this creates risk of silent regressions and makes onboarding new contributors difficult.
  - Recommendation: Implement a basic CI pipeline (GitHub Actions or equivalent) that runs `npm run build` and any test suite on every commit. Even for a learning project, this establishes a quality baseline and makes the codebase safer to extend. Effort is low (S) if tests are added first; currently blocked by lack of tests.
  - Evidence: `TEAM-001`, `QUA-001`, `ARC-001`
- **[MEDIUM] No onboarding or runbook for operational handoff** (effort S) — While the README covers quickstart and design, there is no CONTRIBUTING.md, DEVELOPMENT.md, or runbook documenting how to set up a development environment, run the full test suite (which does not exist), debug common issues, or cut a release. The package.json has build and dev scripts, but no guidance on the development workflow, code review process, or deployment procedure. This makes it difficult for a new team to take over maintenance.
  - Recommendation: Create a DEVELOPMENT.md file covering: (1) local setup steps beyond npm install; (2) how to run examples and verify they work; (3) debugging tips; (4) code style and naming conventions (currently implicit); (5) how to add a new tool or hook. Keep it concise but complete enough for a junior developer to be productive within a day.
  - Evidence: `READ-028`, `TEAM-002`
- **[INFO] Good documentation and clear learning-first design** (effort S) — The repository includes a comprehensive README (104 lines) with quickstart, design notes, and clear boundaries; a detailed AGENTS.md file for orientation; and well-structured examples (6 runnable stage demos). The code is organized into small, single-responsibility files (agent.ts, tools.ts, session.ts, etc.) with minimal dependencies. This is a well-documented learning project that prioritizes clarity and readability, making it relatively easy for a new team member to understand the architecture and intent.
  - Recommendation: Preserve this documentation quality during any extension or maintenance. Use the existing file structure and naming conventions as a template for new features. Consider adding a CONTRIBUTING.md if the project is to accept external contributions.
  - Evidence: `TEAM-002`, `READ-027`, `READ-033`, `ARC-002`

## Evidence

- `ARC-001` 1,094 lines of code: TypeScript 100%
- `ARC-002` npm manifest package.json: 3 runtime and 3 dev dependencies — package.json
- `QUA-001` 15 source files and no test files
- `TEAM-001` No CI configuration found
- `QUA-002` No linter or formatter configuration found
- `TEAM-002` README present (104 lines) — README.md
- `SEC-001` No Dependabot or Renovate configuration found
- `CLD-001` No Dockerfile or compose file found
- `CLD-002` No infrastructure-as-code or deployment configuration found
- `CLD-003` Configuration read from environment variables in 1 files (12-factor) — examples/hello.ts
- `TEAM-003` 3 commits by 1 contributors since 2026-06; 0 in the last 90 days; last commit 116 days ago
- `TEAM-004` Bus factor 1: top contributor authored 100% of commits
- `READ-001` Inspected package.json — package.json
- `READ-002` Inspected README.md — README.md
- `READ-003` Inspected package.json — package.json
- `READ-004` Inspected README.md — README.md
- `READ-005` Inspected README.md — README.md
- `READ-006` Inspected package.json — package.json
- `READ-007` Inspected src/agent.ts — src/agent.ts
- `READ-008` Inspected src/tools.ts — src/tools.ts
- `READ-009` Inspected src/session.ts — src/session.ts
- `READ-010` Inspected src/env.ts — src/env.ts
- `READ-011` Inspected examples/hello.ts — examples/hello.ts
- `READ-012` Inspected src/permissions.ts — src/permissions.ts
- `READ-013` Inspected src/agent.ts — src/agent.ts
- `READ-014` Inspected tsconfig.json — tsconfig.json
- `READ-015` Code search (27-char pattern): 3 matches — src/cli.ts, src/hooks.ts, src/permissions.ts
- `READ-016` Inspected src/permissions.ts — src/permissions.ts
- `READ-017` Inspected src/hooks.ts — src/hooks.ts
- `READ-018` Inspected src/cli.ts — src/cli.ts
- `READ-019` Code search (41-char pattern): 29 matches — .env.example, AGENTS.md, examples/hello.ts, README.md, src/agent.ts
- `READ-020` Inspected .env.example — .env.example
- `READ-021` Inspected src/subagent.ts — src/subagent.ts
- `READ-022` Inspected src/paths.ts — src/paths.ts
- `READ-023` Inspected .gitignore — .gitignore
- `READ-024` Inspected package.json — package.json
- `READ-025` Inspected README.md — README.md
- `READ-026` Inspected .env.example — .env.example
- `READ-027` Inspected README.md — README.md
- `READ-028` Inspected package.json — package.json
- `READ-029` Inspected src/env.ts — src/env.ts
- `READ-030` Inspected tsconfig.json — tsconfig.json
- `READ-031` Code search (66-char pattern): 1 matches — examples/stage5.ts
- `READ-032` Code search (19-char pattern): 1 matches — package-lock.json
- `READ-033` Inspected AGENTS.md — AGENTS.md

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened; 0 model findings were discarded for citing evidence that does not exist. Critical and high scanner flags cannot be removed by the model. Cost: $0.1779 (135,433 tokens).
