# Technology due diligence — https://github.com/tSLoseth/tiny-agent-sdk

_Generated 2026-09-25T19:05:21.016Z · mode: full · model: claude-haiku-4-5-20251001 · 25 files, 1,094 lines of code_

**Overall: 80/100 — Green**

> Solid technical foundation with strong architecture and security (score 80), but lack of automated testing and CI/CD pipeline creates operational risk that must be addressed before close.

## Red flags

- No automated test suite for a public SDK with complex agent loop, tool dispatch, and permission logic—high regression risk with new team members
- Single-contributor project with no CI pipeline—prevents safe onboarding and introduces key-person dependency; confirm original author availability pre-close
- Team process score of 64 reflects absence of testing infrastructure and deployment automation—essential for post-acquisition handoff

## Value-creation levers

- Establish test suite (70%+ coverage of core agent loop, tool execution, permissions) to unlock safe refactoring and feature velocity
- Extract oversized CLI module and gauntlet logic into composable middleware—improves maintainability and extensibility without architectural rework
- Add structured logging and observability hooks to enable production deployment and support multi-tenant or hosted service scenarios
- Implement automated dependency updates (Dependabot) and environment variable schema validation to reduce supply-chain and configuration drift risk

## 100-day plan

1. Days 1–14: Set up CI pipeline (GitHub Actions) with TypeScript compilation check and integrate test runner; confirm original author engagement and knowledge transfer plan
2. Days 15–35: Build test suite for agent loop (src/agent.ts) and CLI (src/cli.ts) using Vitest; target 60%+ coverage of critical paths; integrate into CI
3. Days 36–50: Extract readline input handler and confirmation prompt from CLI into separate modules; add ESLint and Prettier to build pipeline
4. Days 51–70: Add structured logging (pino or winston) at agent loop, tool invocation, and permission check points; document deployment model and environment variables
5. Days 71–85: Refactor tool execution gauntlet into middleware chain pattern to decouple permissions and hooks; add state versioning and migration logic
6. Days 86–100: Configure Dependabot for automated security updates; document public API exports and module boundaries; conduct knowledge transfer review with incoming team

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 88 | Green | 6 |
| Code quality & tech debt | 75 | Amber | 5 |
| Security | 94 | Green | 4 |
| Cloud readiness | 80 | Green | 4 |
| Team & process | 64 | Amber | 4 |

## Findings

### Architecture & stack

- **[MEDIUM] Tight coupling between tool execution and permission/hook layers** (effort M) — The executeToolCall function in agent.ts orchestrates the full gauntlet: pre-hooks → permission policy → tool dispatch → post-hooks. While this ensures consistent enforcement, it creates a single point where all three concerns (permissions, hooks, tool execution) are tightly woven together. If a new cross-cutting concern (e.g., rate limiting, retry logic, or audit enrichment) needs to be added, it must be threaded through this function. The function signature already has 7 parameters, and adding more concerns will increase complexity.
  - Recommendation: Consider extracting the gauntlet logic into a composable middleware or interceptor chain. This would allow new concerns to be added without modifying executeToolCall. For example, a ToolExecutor interface with a chain-of-responsibility pattern would decouple concerns and improve extensibility.
  - Evidence: `READ-007`
- **[LOW] No abstraction over the Anthropic API; direct dependency on Messages API** (effort L) — The agent loop directly uses the Anthropic Messages API (client.messages.stream, stop_reason, tool_use blocks). There is no provider abstraction layer. This is intentional per the README ("targets the Anthropic API only, on purpose"), and appropriate for a learning project. However, it means the SDK cannot be extended to support other LLM providers (OpenAI, Gemini, etc.) without significant refactoring. The tight coupling to Anthropic's message format and tool schema is baked into agent.ts, tools.ts, and session.ts.
  - Recommendation: This is acceptable for the current scope. If multi-provider support becomes a future goal, introduce a Provider interface that abstracts message streaming, tool schema conversion, and response parsing. This is a non-trivial refactor (L effort) and should be deferred unless there is a clear business need.
  - Evidence: `READ-007`, `READ-008`, `READ-002`
- **[LOW] State persistence is naive; no versioning or migration strategy** (effort S) — Session state is persisted as raw JSON (messages array) via writeFileSync/readFileSync. There is no versioning, schema validation on load, or migration path. If the message format changes (e.g., new fields added to ToolCall or RunAgentResult), old saved sessions will silently fail to deserialize or will load with missing fields. The load() method does not validate the loaded data against the current schema.
  - Recommendation: Add a version field to the saved state and implement a migration function. Validate loaded state with zod before accepting it. This is low priority for a learning project but becomes important if sessions are used in production or shared across versions.
  - Evidence: `READ-009`
- **[LOW] Subagent isolation is context-based but not capability-based** (effort S) — Subagents are isolated by context (fresh Session with empty messages) and by tool set (the config.tools parameter). However, there is no enforcement that prevents a subagent from being spawned with the same tools as the parent, including spawn_subagent itself. The README notes this as a non-goal ("no runaway recursion"), but the code does not prevent it. A malicious or buggy prompt could cause infinite recursion. The isolation is by convention, not by design.
  - Recommendation: Add a runtime check in createSubagentTool to reject spawn_subagent from the worker's tool set. Alternatively, document this as a caller responsibility and require explicit tool filtering. This is low priority for a learning project but should be addressed before production use.
  - Evidence: `READ-018`, `READ-002`
- **[INFO] Clean, modular architecture with clear separation of concerns** (effort S) — The SDK is well-structured into focused modules: agent.ts (the core loop), tools.ts (tool abstraction and dispatch), session.ts (multi-turn state), permissions.ts (policy layer), hooks.ts (interception points), and subagent.ts (delegation). Each module has a single responsibility and is independently testable. The design explicitly avoids framework lock-in and uses composition over inheritance. The streaming generator pattern (runAgentStream) elegantly provides both blocking and streaming interfaces from a single implementation, avoiding code duplication.
  - Recommendation: This is a strength. Maintain this modular structure as the codebase grows. Document the module boundaries and dependency graph to help future maintainers.
  - Evidence: `READ-007`, `READ-008`, `READ-009`, `READ-016`, `READ-017`, `READ-018`, `READ-002`
- **[INFO] Minimal, well-chosen dependency footprint** (effort S) — The SDK has only 3 runtime dependencies: @anthropic-ai/sdk (the API client), zod (schema validation), and zod-to-json-schema (schema serialization). This is appropriate for a learning project and a library. The dependencies are stable, widely-used packages. No heavy frameworks or unnecessary transitive bloat. The dev stack (TypeScript, tsx, @types/node) is standard and minimal.
  - Recommendation: This is a strength. Keep the dependency count low. If adding features, prefer composition with existing tools over new dependencies.
  - Evidence: `READ-001`, `ARC-002`

### Code quality & tech debt

- **[HIGH] No automated tests in a learning SDK with public API surface** (effort M) — The repository contains 15 source files (1,094 lines of TypeScript) across core modules (agent.ts, tools.ts, session.ts, permissions.ts, hooks.ts, subagent.ts) and examples, but zero test files. The SDK exports a public API (RunAgentOptions, RunAgentResult, AgentEvent, Session, Tool types) and implements complex logic including streaming, permission policies, hooks, and subagent delegation. Without tests, regressions in the agent loop, tool dispatch, permission enforcement, or state management cannot be caught automatically. The README explicitly states this is a learning project, but the absence of tests makes it difficult to verify correctness of the core loop or refactor safely.
  - Recommendation: Add a test suite covering the agent loop (runAgentStream, runAgent), tool dispatch and validation, permission policy verdicts, hook execution order, and session state persistence. Start with unit tests for the core loop (mocking the Anthropic client) and integration tests for the CLI. Target 70%+ coverage of src/ files. Use a lightweight framework (e.g., Node's built-in test runner or Vitest) to keep dependencies minimal.
  - Evidence: `QUA-001`, `READ-013`, `READ-014`, `READ-006`
- **[MEDIUM] Oversized CLI module with mixed concerns** (effort S) — The src/cli.ts file is 153 lines and combines multiple responsibilities: readline input handling (paste-aware buffering with timers), permission confirmation logic, subagent tool creation, session setup, and the main REPL loop. The paste-aware input logic (lines 30–60 in READ-014) is a custom state machine with timers and backlog management that could be extracted. This makes the module harder to test in isolation and increases cognitive load for maintainers.
  - Recommendation: Extract the readline input handler (nextInput, deliver, backlog, timer logic) into a separate module (e.g., src/input.ts). Extract the confirmation prompt into a separate function or module. This will make the CLI loop clearer and allow the input handler to be tested independently.
  - Evidence: `READ-014`
- **[LOW] No linter or code formatter configured** (effort S) — The repository has no ESLint, Prettier, Biome, or other linting/formatting configuration. While TypeScript strict mode is enabled in tsconfig.json (READ-021), there is no automated enforcement of code style, import ordering, or common pitfalls (unused variables, implicit any, etc.). This increases the cost of code review and makes onboarding contributors harder.
  - Recommendation: Add ESLint with a standard config (e.g., @typescript-eslint/recommended) and Prettier for formatting. Include both in the build pipeline and pre-commit hooks. This is a low-effort hygiene improvement that will reduce friction in future maintenance.
  - Evidence: `QUA-002`, `READ-021`
- **[LOW] TypeScript strict mode enabled but no type exports documented** (effort S) — The tsconfig.json enables strict mode (READ-021), which is good practice. However, the package.json marks the project as private and does not publish type definitions or a public API surface. The README notes this is a learning project not published to npm. Without a clear public API contract or type exports, future consumers (or a future npm release) may face friction integrating the SDK.
  - Recommendation: If the project is intended to remain private/educational, no action is needed. If it is later published, add an index.ts that explicitly exports the public API (RunAgentOptions, RunAgentResult, Session, Tool, etc.), enable declaration: true in tsconfig.json, and document the API in a separate file (e.g., API.md).
  - Evidence: `READ-021`, `READ-005`, `READ-006`
- **[INFO] Clear module boundaries and single-responsibility design** (effort S) — The source code is well-organized into focused modules: agent.ts (the loop), tools.ts (tool dispatch and validation), session.ts (multi-turn state), permissions.ts (policy verdicts), hooks.ts (pre/post-tool interception), and subagent.ts (delegation). Each module has a clear purpose documented in comments. The agent loop itself (runAgentStream) is implemented once and reused by both streaming and blocking callers (runAgent), avoiding duplication. This design makes the codebase easy to follow and modify.
  - Recommendation: Preserve this structure as the codebase grows. Document the module contracts (inputs, outputs, side effects) in JSDoc comments to aid future maintainers.
  - Evidence: `READ-013`, `READ-006`

### Security

- **[MEDIUM] No automated dependency updates; manual review required for supply-chain risk** (effort S) — The repository has no Dependabot or Renovate configuration. The package.json declares 3 runtime dependencies (@anthropic-ai/sdk, zod, zod-to-json-schema) and 3 dev dependencies, all pinned to caret ranges (^). With only 3 commits and no CI pipeline, there is no automated mechanism to detect or apply security patches. A vulnerability in any transitive dependency would require manual discovery and remediation.
  - Recommendation: Add Dependabot or Renovate configuration to automate dependency updates and security alerts. Given the learning-project status and small dependency footprint, this is a low-effort addition (S) that would significantly reduce supply-chain risk.
  - Evidence: `SEC-001`, `READ-003`, `TEAM-001`
- **[INFO] Secrets handling follows 12-factor principles with proper environment isolation** (effort S) — The SDK correctly reads the Anthropic API key from environment variables only, never embedding it in code. The custom .env loader (src/env.ts) is minimal and tolerant of quoting variations. The .gitignore properly excludes .env files while preserving .env.example as a template. The example code (examples/hello.ts) demonstrates the pattern: loadEnv() pulls the key into process.env before the SDK client is instantiated, ensuring the credential never appears in source.
  - Recommendation: Continue this practice. No action required.
  - Evidence: `READ-010`, `READ-011`, `READ-012`, `READ-020`
- **[INFO] Path traversal and command injection mitigated by defense-in-depth design** (effort S) — The tools layer implements two independent guards against path escape and command injection. File tools (read_file, list_dir, write_file) call resolveInside() to reject paths that climb outside the workspace root before the permission policy is even consulted. The run_command tool accepts arbitrary shell commands but the permission policy (workspacePolicy) gates execution: allowlisted commands (e.g., 'ls', 'pwd') auto-allow; all others defer to human confirmation. Errors are fed back to the model as strings rather than thrown, allowing self-correction. This layered approach (tool-level validation + policy-level gating + human confirmation) is sound.
  - Recommendation: This design is appropriate for the asset's scope (a learning SDK with sandboxed file and command tools). No changes needed.
  - Evidence: `READ-025`, `READ-026`
- **[INFO] Minimal dependency footprint reduces supply-chain surface area** (effort S) — The SDK declares only 3 runtime dependencies (Anthropic SDK, Zod, and zod-to-json-schema) and 3 dev dependencies. This is unusually lean for a TypeScript project and significantly reduces the attack surface from transitive dependencies. The hand-rolled .env loader avoids adding dotenv as a dependency, keeping the footprint intentional and auditable.
  - Recommendation: Maintain this discipline. Before adding any new dependency, evaluate whether it can be hand-rolled or replaced with a lighter alternative.
  - Evidence: `READ-003`, `READ-010`

### Cloud readiness

- **[MEDIUM] No containerisation or deployment packaging** (effort S) — The asset has no Dockerfile, Docker Compose, or container configuration. It is a TypeScript SDK distributed as source code with npm scripts (build, dev, hello, cli) but no container image or deployment manifest. For a learning project explicitly marked as non-production (README states "not a production runtime"), this is appropriate; however, if the asset is to be deployed as a service or integrated into a cloud platform, containerisation would be required.
  - Recommendation: If the asset remains a library or CLI tool distributed via npm, containerisation is not required. If it is to be deployed as a hosted service, add a Dockerfile with a Node 20+ base image, multi-stage build for TypeScript compilation, and a minimal runtime layer. Effort is low (S) for a basic setup.
  - Evidence: `CLD-001`, `READ-028`, `READ-029`
- **[MEDIUM] No infrastructure-as-code or deployment configuration** (effort M) — The repository contains no Terraform, CloudFormation, Kubernetes manifests, or other infrastructure-as-code. There is no CI/CD pipeline, no deployment target definition, and no environment-specific configuration beyond a single .env.example file. The asset is designed as a standalone learning project with manual execution via npm scripts.
  - Recommendation: Define deployment targets and infrastructure as code. For a cloud-native deployment, create Kubernetes manifests or Terraform modules. For simpler hosting (e.g., AWS Lambda, Cloud Run), add serverless configuration. At minimum, document the deployment model and required environment variables in a deployment guide.
  - Evidence: `CLD-002`, `TEAM-001`, `READ-028`
- **[MEDIUM] No observability or logging infrastructure** (effort M) — The codebase has no structured logging, metrics collection, or tracing. The agent loop (src/agent.ts) and tool execution (src/tools.ts) emit no logs or events suitable for cloud observability platforms. The PostToolUse hook (src/hooks.ts) is described as a lightweight audit stand-in but does not integrate with standard logging or APM tools.
  - Recommendation: Add structured logging using a library like `pino` or `winston`. Emit logs at key points: agent loop entry/exit, tool invocation, permission checks, and errors. If the asset is deployed as a service, integrate with a cloud logging platform (e.g., CloudWatch, Stackdriver) and add basic metrics (request count, latency, errors). For a library, provide hooks or a logging interface that consumers can wire to their own observability stack.
  - Evidence: `READ-029`, `ARC-001`
- **[LOW] Partial 12-factor compliance: environment variables used, but limited scope** (effort S) — The asset reads ANTHROPIC_API_KEY from environment variables via a custom .env loader (src/env.ts), following 12-factor principles. However, only one configuration value is externalized. The custom loader walks up the directory tree to find .env, which is non-standard and may cause unexpected behavior in containerised or cloud environments where the working directory is fixed.
  - Recommendation: Standardise environment variable loading: use Node's built-in `--env-file` flag (Node 20.10+) or the `dotenv` package. Document all required environment variables in a schema (e.g., using zod, which is already a dependency). Remove the directory-walking logic to ensure predictable behavior in containerised deployments.
  - Evidence: `CLD-003`, `READ-033`, `READ-034`

### Team & process

- **[HIGH] Single-contributor project with no CI pipeline** (effort S) — The repository has only 3 commits by 1 contributor, with the last commit 116 days ago and no activity in the last 90 days. More critically, there is no CI/CD configuration (no GitHub Actions, GitLab CI, CircleCI, or equivalent). The project is explicitly marked as a learning/demo asset in the README ("Learning project. ~9 source files, zero framework. Not published to npm."), but the absence of automated build and test gates creates delivery risk if this code is to be maintained or extended post-acquisition.
  - Recommendation: Establish a CI pipeline (GitHub Actions or equivalent) that runs `npm run build` and any test suite on every commit. This is essential for onboarding new team members and preventing regressions. Given the project's educational nature, a minimal pipeline (TypeScript compilation check) is sufficient as a starting point.
  - Evidence: `TEAM-001`, `TEAM-003`, `TEAM-004`, `READ-030`
- **[HIGH] No automated tests or test infrastructure** (effort M) — The scanner reports 15 source files and 0 test files (QUA-001). Combined with the absence of CI, there is no automated verification that the code works as intended. For a learning project this may be acceptable, but if the asset is to be maintained or extended, the lack of test coverage creates risk of silent regressions and makes refactoring unsafe.
  - Recommendation: Establish a test suite using a framework like Jest or Vitest. Start with integration tests for the core agent loop (src/agent.ts) and the CLI (src/cli.ts). Integrate test execution into the CI pipeline. Target at least 60% coverage of critical paths (agent loop, tool execution, permissions).
  - Evidence: `QUA-001`, `TEAM-001`
- **[MEDIUM] Project dormancy and key-person dependency** (effort S) — The repository has been inactive for 116 days (last commit in June 2026, assessed in October 2026). All 3 commits are authored by a single contributor (bus factor = 1). While the commit history is too short to formally assess key-person risk, the combination of zero activity, single authorship, and explicit learning-project status means there is no active development team and no redundancy. If the original author is unavailable, there is no one else familiar with the codebase.
  - Recommendation: Before acquisition close, identify the original author and confirm their availability and willingness to support the asset post-close. Plan for knowledge transfer (pair programming, code review, documentation) with incoming team members. Consider whether this asset will be actively maintained or archived.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[INFO] Adequate documentation for a learning project** (effort S) — The README (104 lines) is well-structured and clearly explains the project's purpose, design, and non-goals. It includes a quickstart guide, stage-by-stage examples, and design rationale. The codebase is small (1,094 lines of TypeScript across 15 source files) and each concept is documented as living in a specific file (e.g., agent loop in src/agent.ts, tools in src/tools.ts). This clarity is a strength for onboarding and understanding the asset's scope.
  - Recommendation: Preserve and maintain this documentation standard. As the team grows, ensure new contributors update the README and inline comments when adding features.
  - Evidence: `TEAM-002`, `READ-030`, `ARC-001`

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
- `TEAM-003` 3 commits by 1 contributors since 2026-06; 0 in the last 90 days; last commit 116 days ago; history too short to assess key-person risk (3 commits)
- `TEAM-004` Bus factor 1: top contributor authored 100% of commits
- `READ-001` Inspected package.json — package.json
- `READ-002` Inspected README.md — README.md
- `READ-003` Inspected package.json — package.json
- `READ-004` Inspected README.md — README.md
- `READ-005` Inspected package.json — package.json
- `READ-006` Inspected README.md — README.md
- `READ-007` Inspected src/agent.ts — src/agent.ts
- `READ-008` Inspected src/tools.ts — src/tools.ts
- `READ-009` Inspected src/session.ts — src/session.ts
- `READ-010` Inspected src/env.ts — src/env.ts
- `READ-011` Inspected examples/hello.ts — examples/hello.ts
- `READ-012` Inspected .env.example — .env.example
- `READ-013` Inspected src/agent.ts — src/agent.ts
- `READ-014` Inspected src/cli.ts — src/cli.ts
- `READ-015` Code search (32-char pattern): 11 matches — src/cli.ts, src/env.ts, src/hooks.ts, src/permissions.ts, src/subagent.ts
- `READ-016` Inspected src/permissions.ts — src/permissions.ts
- `READ-017` Inspected src/hooks.ts — src/hooks.ts
- `READ-018` Inspected src/subagent.ts — src/subagent.ts
- `READ-019` Code search (51-char pattern): 18 matches — .env.example, AGENTS.md, examples/hello.ts, README.md, src/agent.ts
- `READ-020` Inspected .gitignore — .gitignore
- `READ-021` Inspected tsconfig.json — tsconfig.json
- `READ-022` Code search (40-char pattern): 0 matches
- `READ-023` Inspected src/cli.ts — src/cli.ts
- `READ-024` Code search (38-char pattern): 50 matches — examples/hello.ts, examples/stage1.ts, examples/stage2.ts, examples/stage3.ts, examples/stage4.ts
- `READ-025` Inspected src/permissions.ts — src/permissions.ts
- `READ-026` Inspected src/tools.ts — src/tools.ts
- `READ-027` Code search (26-char pattern): 0 matches
- `READ-028` Inspected package.json — package.json
- `READ-029` Inspected README.md — README.md
- `READ-030` Inspected README.md — README.md
- `READ-031` Inspected package.json — package.json
- `READ-032` Inspected .env.example — .env.example
- `READ-033` Inspected src/env.ts — src/env.ts
- `READ-034` Inspected examples/hello.ts — examples/hello.ts
- `READ-035` Code search (60-char pattern): 0 matches

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened. 0 model findings were discarded for citing evidence that does not exist, and 5 findings were removed as cross-dimension duplicates. Critical and high scanner flags cannot be removed by the model. Cost: $0.2001 (160,382 tokens).
