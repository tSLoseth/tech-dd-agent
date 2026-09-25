# Technology due diligence — https://github.com/tSLoseth/tiny-agent-sdk

_Generated 2026-09-25T18:36:41.259Z · mode: full · model: claude-haiku-4-5-20251001 · 25 files, 1,094 lines of code_

**Overall: 83/100 — Green**

> Solid acquisition at 83/100 with exemplary architecture and security, but critical gaps in testing and team continuity must be addressed before close.

## Red flags

- Zero automated tests covering critical paths (agent loop, permission logic, tool dispatch) creates operational risk and blocks confident deployment.
- Single contributor with no recent activity creates extreme bus factor; knowledge transfer and team onboarding must happen before acquisition closes.
- No CI/CD pipeline means code changes are not automatically validated; syntax and type errors can reach production.

## Value-creation levers

- Build comprehensive test suite (>70% coverage) to unlock confident scaling and reduce post-acquisition defect risk; estimated 3–4 weeks.
- Refactor oversized CLI module into separate input handler and factory functions to improve testability and enable code reuse; estimated 1–2 weeks.
- Add structured logging and observability (pino/winston with correlation IDs) to support cloud deployment and operational visibility; estimated 1–2 weeks.
- Implement multi-provider LLM abstraction layer to reduce lock-in to Anthropic and increase market flexibility; estimated 2–3 weeks.
- Add Dockerfile and basic IaC (Terraform/CloudFormation) to enable rapid cloud deployment and reduce time-to-revenue; estimated 1–2 weeks.

## 100-day plan

1. Days 1–14: Execute knowledge transfer with current contributor; document design decisions, deployment procedures, and API patterns. Assign one team member to pair-program and create operational runbooks.
2. Days 15–35: Implement Jest/Vitest test suite covering agent loop (happy path, tool errors, max-steps), permission verdicts, and tool dispatch. Target >70% coverage of src/.
3. Days 36–50: Refactor CLI module: extract input handler to src/input.ts and tool/session setup into factory functions. Add structured error logging with context (tool name, input, error type, stack trace).
4. Days 51–65: Set up CI/CD pipeline (GitHub Actions or equivalent) to run TypeScript compilation, linting, and test suite on pull requests. Add ESLint + Prettier configuration.
5. Days 66–85: Integrate structured logging library (pino or winston) with JSON output and correlation IDs. Add Dockerfile with multi-stage build and document deployment model.
6. Days 86–100: Create CONTRIBUTING.md with development setup, code style, commit format, PR checklist, and tool-addition guide. Set up Dependabot for automated security patch updates.

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 98 | Green | 3 |
| Code quality & tech debt | 71 | Amber | 5 |
| Security | 94 | Green | 3 |
| Cloud readiness | 80 | Green | 4 |
| Team & process | 73 | Amber | 4 |

## Findings

### Architecture & stack

- **[LOW] Tight coupling to Anthropic API with no provider abstraction** (effort M) — The codebase is tightly coupled to the Anthropic Messages API. The agent loop (agent.ts) directly uses Anthropic types and methods (client.messages.stream, stop_reason, tool_use blocks). The README explicitly states this is intentional ("targets the Anthropic API only, on purpose"), which is appropriate for a learning project. However, this design choice limits portability and makes it difficult to swap in alternative LLM providers (OpenAI, Cohere, etc.) without significant refactoring. For a production SDK, this might be a limitation.
  - Recommendation: This is a deliberate design choice and appropriate for the project's scope. If the SDK is to support multiple providers in the future, consider defining an internal LLM interface (e.g., LLMClient) that abstracts away provider-specific details. This would be a medium-effort refactor (M) but would significantly increase flexibility.
  - Evidence: `READ-010`, `READ-006`
- **[INFO] Exemplary modular architecture with clear separation of concerns** (effort S) — The codebase demonstrates excellent architectural design for a learning SDK. The core loop (agent.ts) is cleanly separated from tools (tools.ts), permissions (permissions.ts), hooks (hooks.ts), and session state (session.ts). Each module has a single, well-defined responsibility. The streaming generator pattern (runAgentStream) with a non-streaming wrapper (runAgent) avoids code duplication and provides two clean front doors. Tool abstraction uses Zod for both schema definition and runtime validation, bridging TypeScript types to JSON Schema automatically. The permission policy is declarative (allow/deny/ask), while hooks provide imperative extension points—a clean separation that mirrors production systems like Claude Code.
  - Recommendation: This architecture is a strength. Maintain this separation as the codebase grows. The staged examples (hello.ts through stage5.ts) effectively demonstrate each concept incrementally, which is valuable for onboarding.
  - Evidence: `READ-010`, `READ-011`, `READ-012`, `READ-020`, `READ-021`
- **[INFO] Minimal, focused dependency footprint with appropriate choices** (effort S) — The project declares only 3 runtime dependencies: @anthropic-ai/sdk (the core API client), zod (schema validation), and zod-to-json-schema (schema serialization). This is lean and intentional. Zod is the right choice for runtime validation and schema generation—it avoids the need for separate schema definition and validation libraries. The dev dependencies (TypeScript, tsx, @types/node) are minimal and standard. No framework bloat, no unnecessary abstractions. The package.json explicitly marks this as a learning project (private: true, not published to npm), which is appropriate.
  - Recommendation: Keep dependencies minimal. If the project evolves beyond a learning tool, consider whether additional dependencies (e.g., for logging, observability, or persistence) are truly needed or if they can be injected by consumers.
  - Evidence: `READ-005`, `ARC-002`

### Code quality & tech debt

- **[HIGH] No automated tests; critical paths untested** (effort M) — The codebase contains 15 source files (1,094 lines of TypeScript) with zero test files. The core agent loop (src/agent.ts, 180 lines) — which orchestrates model calls, tool execution, permission checks, and hook invocation — has no unit or integration tests. The permission policy (src/permissions.ts, 61 lines) and tool dispatch logic (src/tools.ts, 156 lines) are also untested. This is a learning project, but the absence of tests means regressions in the agent loop, tool execution, or permission enforcement cannot be caught automatically. For a buyer, this creates maintenance risk and slows future feature work.
  - Recommendation: Add a test suite covering the agent loop (happy path, tool errors, max-steps limit), permission policy verdicts (allow/deny/ask), and tool dispatch. Start with the core loop and permission logic; aim for >70% coverage of src/. Use Jest or Vitest; estimate 3–4 person-weeks to reach baseline coverage.
  - Evidence: `QUA-001`, `READ-013`, `READ-014`, `READ-018`
- **[MEDIUM] Oversized CLI module with mixed concerns** (effort M) — src/cli.ts is 153 lines and combines input handling (readline, paste coalescing), session management, tool setup, permission policy configuration, and hook registration. The paste-aware input buffering logic (lines 30–60) is tightly coupled to the REPL loop. This makes the module hard to test in isolation and difficult to reuse the CLI logic in other contexts (e.g., a web server or batch runner).
  - Recommendation: Extract the input handler (readline + paste coalescing) into a separate module (e.g., src/input.ts). Extract session and tool setup into a factory function. This will make the CLI testable and allow the input handler to be reused. Effort: 1–2 person-weeks.
  - Evidence: `READ-014`
- **[MEDIUM] Minimal error handling in tool execution** (effort M) — The tool dispatch logic (src/tools.ts, lines 140–156) catches errors from file operations and shell commands and returns them as error results to the model. However, there is no logging of errors, no retry logic, and no distinction between transient and permanent failures. If a tool fails, the model sees only the error text; operators have no visibility into what went wrong or why. For a production agent, this makes debugging and monitoring difficult.
  - Recommendation: Add structured error logging (e.g., with context: tool name, input, error type, stack trace). Consider adding retry logic for transient failures (e.g., ENOENT on a race condition). Effort: 1–2 person-weeks.
  - Evidence: `READ-013`
- **[LOW] No linter or code formatter configured** (effort S) — The repository has no ESLint, Prettier, or similar configuration. TypeScript strict mode is enabled (tsconfig.json), which catches type errors, but there is no automated enforcement of style, import ordering, or common pitfalls (unused variables, missing error handling). Code review must rely on manual inspection.
  - Recommendation: Add ESLint with a standard config (e.g., eslint-config-prettier) and Prettier. Add a pre-commit hook or CI step to enforce formatting. Effort: <1 person-week.
  - Evidence: `QUA-002`, `READ-019`
- **[INFO] Clean, modular architecture with clear separation of concerns** (effort S) — The codebase is well-organized into focused modules: the agent loop (src/agent.ts), tools (src/tools.ts), permissions (src/permissions.ts), hooks (src/hooks.ts), and session state (src/session.ts). Each module has a single responsibility and is documented with clear comments explaining its role. The streaming generator pattern (runAgentStream) is elegant and avoids code duplication. The README is thorough and includes runnable examples (examples/stage1.ts through stage5.ts) that demonstrate each concept incrementally. This is a learning project, but the code is readable and maintainable.
  - Recommendation: Maintain this modular structure as the codebase grows. Use the examples as a foundation for integration tests.
  - Evidence: `READ-004`, `READ-013`, `READ-014`

### Security

- **[MEDIUM] No automated dependency updates** (effort S) — The repository has no Dependabot or Renovate configuration. With 3 runtime dependencies (@anthropic-ai/sdk, zod, zod-to-json-schema) and 3 dev dependencies, the codebase relies on manual updates to patch security vulnerabilities in transitive dependencies. Given the asset's educational purpose and small scope, this is manageable but represents a supply-chain risk if the code were to be deployed or published.
  - Recommendation: Add a Dependabot or Renovate configuration to automate dependency updates. For a learning project, weekly or monthly checks are sufficient. Prioritize security patches.
  - Evidence: `SEC-001`
- **[INFO] Secrets handling is well-designed but relies on manual discipline** (effort S) — The codebase demonstrates strong secrets handling practices: ANTHROPIC_API_KEY is read from environment variables via a custom .env loader (src/env.ts), never hardcoded. The .gitignore correctly excludes .env files while preserving .env.example as a template. The custom loader is intentional—it tolerates quoted values and walks up the directory tree, avoiding an extra dependency. No API keys or credentials are visible in the repository.
  - Recommendation: Continue this practice. Document in the README that .env must never be committed (already done). Consider adding a pre-commit hook to catch accidental .env commits, though .gitignore is the primary safeguard.
  - Evidence: `READ-007`, `READ-008`, `READ-009`, `READ-017`, `READ-016`
- **[INFO] Path traversal and command injection are defended in depth** (effort S) — The tools layer implements two independent guards against path escape and command injection: (1) the permission policy (src/permissions.ts) validates intent before any tool runs, denying file operations outside the workspace root; (2) the tool handlers themselves use resolveInside() to enforce the same boundary at execution time. Command execution uses child_process.exec with a 15-second timeout and explicit cwd scoping. The design follows the principle of defense in depth—a single guard failure does not compromise safety.
  - Recommendation: This design is sound for an educational SDK. If deployed as a service, add audit logging of all tool calls (the PostToolUse hook in src/hooks.ts is already designed for this) and consider rate-limiting command execution.
  - Evidence: `READ-023`, `READ-024`

### Cloud readiness

- **[MEDIUM] No containerisation or deployment packaging** (effort S) — The asset has no Dockerfile, Docker Compose, or container configuration. It is a CLI tool and SDK library distributed as source code requiring local Node.js 20+ and npm install. For cloud deployment or CI/CD integration, containerisation would be needed. The README explicitly states this is a learning project not intended for production use, which contextualises the gap.
  - Recommendation: If the asset is to be deployed as a service or integrated into cloud pipelines, add a Dockerfile with a Node.js base image, multi-stage build for TypeScript compilation, and a minimal runtime layer. For now, document the deployment model (source-only, requires Node 20+).
  - Evidence: `CLD-001`, `READ-026`
- **[MEDIUM] No infrastructure-as-code or deployment configuration** (effort M) — No Terraform, CloudFormation, Helm charts, or other IaC files are present. The asset is a standalone SDK with no deployment manifests, environment-specific configs, or orchestration definitions. This limits repeatability and cloud-native deployment patterns.
  - Recommendation: Define deployment targets (e.g., Lambda, ECS, or Kubernetes) and create corresponding IaC templates. Start with a simple Terraform module or CloudFormation template for the most likely deployment scenario. For a library-only use case, this may be deferred to consumers.
  - Evidence: `CLD-002`, `READ-026`
- **[MEDIUM] No observability or logging infrastructure** (effort M) — The codebase has no structured logging, tracing, or metrics collection. The CLI and agent loop (src/agent.ts, src/cli.ts) use console output for user interaction but no machine-readable logs, no correlation IDs, and no integration with observability platforms. This makes debugging and monitoring in cloud environments difficult.
  - Recommendation: Integrate a structured logging library (e.g., pino or winston) with JSON output. Add correlation IDs to trace requests through the agent loop. For cloud deployment, ensure logs are written to stdout/stderr for container log aggregation. Consider adding basic metrics (tool execution time, API call counts) if the asset becomes a service.
  - Evidence: `ARC-001`
- **[LOW] 12-factor environment configuration partially implemented** (effort S) — The SDK reads ANTHROPIC_API_KEY from environment variables via a custom .env loader (src/env.ts), which is 12-factor compliant. However, the implementation is hand-rolled rather than using a standard package (dotenv), and the loader only handles a single key. The .env.example file documents the pattern. This is adequate for a learning project but not production-grade.
  - Recommendation: For production use, adopt a standard .env library (dotenv) or rely on Node's native --env-file flag (Node 20.10+). Extend configuration to cover other runtime parameters (API endpoints, timeouts, log levels) as the asset grows.
  - Evidence: `CLD-003`, `READ-030`, `READ-031`

### Team & process

- **[HIGH] Critical bus factor: single contributor with zero recent activity** (effort M) — The repository has a bus factor of 1, with 100% of commits authored by a single contributor. The project has been dormant for 116 days (since June 2026), with only 3 commits total and no activity in the last 90 days. This creates significant key-person risk: if the sole contributor becomes unavailable, there is no one else familiar with the codebase to maintain, debug, or extend it.
  - Recommendation: Before acquisition, establish a knowledge transfer plan with the current contributor. Document critical design decisions, deployment procedures, and API integration patterns. Assign at least one team member to pair-program on the codebase and create runbooks for common operational tasks.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[MEDIUM] No CI/CD pipeline configured** (effort S) — The project has no continuous integration configuration (GitHub Actions, GitLab CI, or equivalent). There is no automated build, test, or deployment process. This means code changes are not validated before merge, and there is no automated gate to catch regressions or breaking changes.
  - Recommendation: Implement a basic CI pipeline that runs `npm run build` and any test suite on pull requests. Given the project's learning-focused nature and lack of tests (QUA-001), start with TypeScript compilation and linting as the gate. This will catch syntax errors and type mismatches early.
  - Evidence: `TEAM-001`
- **[MEDIUM] Minimal documentation of development process and onboarding** (effort S) — While the README (READ-027) is well-written and explains the SDK's concepts clearly, there is no CONTRIBUTING.md, DEVELOPMENT.md, or similar guide for new team members. The project lacks documented conventions for code style, commit messages, PR review process, or local development setup beyond the basic quickstart. This slows onboarding and increases the risk of inconsistent contributions.
  - Recommendation: Create a CONTRIBUTING.md file documenting: (1) local development setup and how to run examples; (2) code style expectations (TypeScript conventions, naming); (3) commit message format; (4) PR review checklist; (5) how to add new tools or hooks. Link it from the README.
  - Evidence: `TEAM-002`, `READ-027`
- **[INFO] Clear, modular architecture aids knowledge transfer** (effort S) — The codebase is well-structured with small, focused modules (agent.ts, tools.ts, session.ts, permissions.ts, hooks.ts, subagent.ts) and a clear progression of examples (hello.ts through stage5.ts) that demonstrate each concept incrementally. The README explicitly maps concepts to files and explains the design philosophy. This modularity and documentation reduce the cognitive load for new team members and make the codebase easier to understand despite the single-contributor history.
  - Recommendation: Preserve this modular structure during any refactoring. Use the staged examples as a template for integration tests once a test framework is added.
  - Evidence: `READ-027`, `ARC-001`

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
- `READ-005` Inspected package.json — package.json
- `READ-006` Inspected README.md — README.md
- `READ-007` Inspected src/env.ts — src/env.ts
- `READ-008` Inspected examples/hello.ts — examples/hello.ts
- `READ-009` Inspected .env.example — .env.example
- `READ-010` Inspected src/agent.ts — src/agent.ts
- `READ-011` Inspected src/tools.ts — src/tools.ts
- `READ-012` Inspected src/session.ts — src/session.ts
- `READ-013` Inspected src/agent.ts — src/agent.ts
- `READ-014` Inspected src/cli.ts — src/cli.ts
- `READ-015` Code search (29-char pattern): 9 matches — src/env.ts, src/hooks.ts, src/permissions.ts, src/subagent.ts, src/tools.ts
- `READ-016` Code search (51-char pattern): 18 matches — .env.example, AGENTS.md, examples/hello.ts, README.md, src/agent.ts
- `READ-017` Inspected .gitignore — .gitignore
- `READ-018` Code search (27-char pattern): 3 matches — src/cli.ts, src/hooks.ts, src/permissions.ts
- `READ-019` Inspected tsconfig.json — tsconfig.json
- `READ-020` Inspected src/permissions.ts — src/permissions.ts
- `READ-021` Inspected src/hooks.ts — src/hooks.ts
- `READ-022` Code search (15-char pattern): 50 matches — examples/hello.ts, examples/stage1.ts, examples/stage2.ts, examples/stage3.ts, examples/stage4.ts
- `READ-023` Inspected src/permissions.ts — src/permissions.ts
- `READ-024` Inspected src/tools.ts — src/tools.ts
- `READ-025` Inspected package.json — package.json
- `READ-026` Inspected README.md — README.md
- `READ-027` Inspected README.md — README.md
- `READ-028` Inspected package.json — package.json
- `READ-029` Code search (52-char pattern): 30 matches — examples/hello.ts, examples/stage1.ts, examples/stage2.ts, examples/stage3.ts
- `READ-030` Inspected src/env.ts — src/env.ts
- `READ-031` Inspected .env.example — .env.example
- `READ-032` Inspected tsconfig.json — tsconfig.json

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened; 0 model findings were discarded for citing evidence that does not exist. Critical and high scanner flags cannot be removed by the model. Cost: $0.1687 (130,898 tokens).
