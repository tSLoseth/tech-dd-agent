# Technology due diligence — https://github.com/gothinkster/node-express-realworld-example-app

_Generated 2026-09-25T19:03:06.267Z · mode: full · model: claude-haiku-4-5-20251001 · 67 files, 2,537 lines of code_

**Overall: 68/100 — Amber**

> Solid architectural foundation with good code quality, but security gaps and lack of cloud-native infrastructure must be addressed before production deployment.

## Red flags

- Hardcoded JWT secret fallback creates authentication vulnerability; must be removed and replaced with explicit environment variable requirement before close.
- No infrastructure-as-code, observability, or deployment orchestration—application cannot be reliably deployed to cloud or container environments without significant work.
- Codebase dormant for three years with no CI/CD pipeline; critical decision required on whether this will be actively maintained post-acquisition, as it will need immediate dependency audit and security remediation if retained.
- Six security findings including weak CORS configuration, root container execution, and insufficient password hashing that must be resolved before production use.
- Bus factor risk: top contributor responsible for one-third of commits with minimal documentation; knowledge transfer required if asset will be maintained.

## Value-creation levers

- Implement CI/CD pipeline (GitHub Actions) to enable safe, automated testing and deployment—currently absent and blocking reliable development.
- Add structured logging, health checks, and Prometheus metrics to enable production observability and container orchestration integration.
- Refactor monolithic service layer with repository pattern and strict TypeScript types to reduce coupling, improve testability, and enable future microservice extraction.
- Create infrastructure-as-code (Docker Compose for dev, Kubernetes/Helm for prod) to unlock cloud deployment and multi-environment consistency.
- Establish automated dependency management (Dependabot) and conduct immediate security audit of 39 dependencies given three-year dormancy.

## 100-day plan

1. Days 1–5: Conduct security audit of all dependencies for known CVEs; fix hardcoded JWT secret, CORS configuration, container root user, and bcrypt salt rounds (four high-severity security findings).
2. Days 6–15: Implement CI/CD pipeline with GitHub Actions running lint, test, and build on every commit; resolve Prisma mock issue and complete tag service test coverage.
3. Days 16–30: Add structured logging (Pino or Winston), /health and /ready endpoints, and Prometheus metrics instrumentation for cloud readiness.
4. Days 31–50: Create Docker Compose for local development and Kubernetes manifests or Helm charts for production; integrate database migrations into container startup.
5. Days 51–75: Refactor service layer to introduce repository/data access layer and replace 'any' types with strict TypeScript interfaces; document architecture and API endpoints in README.
6. Days 76–100: Conduct knowledge transfer sessions with original contributors; establish dependency update schedule; plan Nx library refactoring for future modularity.

## Scorecard

| Dimension | Score | Status | Findings |
|---|---:|:---:|---:|
| Architecture & stack | 86 | Green | 4 |
| Code quality & tech debt | 80 | Green | 5 |
| Security | 59 | Amber | 6 |
| Cloud readiness | 58 | Amber | 4 |
| Team & process | 58 | Amber | 4 |

## Findings

### Architecture & stack

- **[MEDIUM] Monolithic service layer with tight database coupling** (effort M) — The service layer (article.service.ts, auth.service.ts, profile.service.ts) directly imports and uses the Prisma client, embedding database queries throughout business logic. The article.service.ts file is 652 lines with complex query-building logic mixed with business rules. Controllers directly call service functions with minimal abstraction. This creates tight coupling between HTTP handlers and data access, making it difficult to test services in isolation or swap data sources.
  - Recommendation: Introduce a repository or data access layer to abstract Prisma operations. Create interfaces for data operations and inject them into services. This will improve testability, reduce coupling, and make the codebase easier to extend with alternative data sources or caching layers.
  - Evidence: `READ-017`, `READ-022`
- **[MEDIUM] Inconsistent error handling and type safety gaps** (effort M) — The error handler in main.ts uses @ts-ignore comments and type assertions (err.errorCode, err.name) without proper type guards. HttpException model is custom but not consistently used across all error paths. Service functions use 'any' types extensively (buildFindAllQuery, createArticle, updateArticle parameters). Controllers catch errors generically and pass to next() without validation. This creates runtime risks where error properties may not exist.
  - Recommendation: Define a strict error hierarchy with discriminated unions or custom error classes. Replace 'any' types in service functions with proper interfaces (e.g., CreateArticleInput, UpdateArticleInput). Add type guards in the error handler. Use TypeScript's strict mode to catch type mismatches at compile time.
  - Evidence: `READ-008`, `READ-017`, `READ-022`
- **[LOW] Nx monorepo structure underutilized for modularity** (effort M) — The project uses Nx (nx.json present, nx commands in package.json) but all source code is in a single src/ directory without library boundaries. Controllers, services, models, and utilities are organized by feature (article, auth, profile, tag) but there are no separate Nx libraries or workspace boundaries to enforce dependency constraints. This limits the ability to scale the codebase or share code across multiple applications.
  - Recommendation: Refactor into Nx libraries: create @api/auth, @api/articles, @api/profiles, @api/shared for common utilities. Define clear dependency rules (e.g., features cannot depend on each other, only on shared). This will improve code organization, enable parallel development, and make it easier to extract services later.
  - Evidence: `READ-001`, `READ-010`
- **[INFO] Clean separation of concerns with feature-based routing** (effort S) — The codebase demonstrates good feature-based organization with clear separation between article, auth, profile, and tag modules. Each feature has its own controller, service, and model files. The routing layer (routes.ts) cleanly composes feature routers. Prisma schema is well-structured with proper relationships and constraints. This modular structure makes it easy to understand and navigate the codebase.
  - Recommendation: Maintain this feature-based structure as the codebase evolves. Consider documenting the architectural patterns (controller → service → repository → database) to guide future contributors.
  - Evidence: `READ-009`, `READ-018`

### Code quality & tech debt

- **[MEDIUM] Incomplete test coverage with stub test blocking tag service validation** (effort S) — The tag service test file contains only a stub test marked with test.todo(), leaving the getTags function untested. The comment indicates a known issue with mocking Prisma's groupBy method. With 7 test files covering 36 source files (19% ratio), and one of those test files being non-functional, the actual coverage is lower. The article service (652 lines) and auth service (183 lines) are tested, but the tag service gap represents a gap in coverage for a core feature.
  - Recommendation: Resolve the Prisma mock issue for tag.groupBy (likely requires jest-mock-extended configuration or a different mocking strategy) and implement the getTags test. Consider adding a test coverage threshold to the CI pipeline once it is established.
  - Evidence: `QUA-001`, `READ-004`, `READ-013`
- **[MEDIUM] Large service module with complex query building logic** (effort M) — The article.service.ts file is 652 lines, containing multiple complex functions with deeply nested Prisma query builders. The buildFindAllQuery function constructs dynamic queries with multiple conditional branches (author, tag, favorited filters), and similar query patterns are repeated across getArticles, getFeed, and other functions. This creates maintenance risk: changes to query structure must be replicated in multiple places, and the lack of abstraction makes the code harder to test and reason about.
  - Recommendation: Refactor query building into reusable helper functions or a query builder class. Extract the repeated include/select patterns into constants. Consider breaking the service into smaller, focused modules (e.g., article-query.service.ts, article-mutation.service.ts). This will improve testability and reduce duplication.
  - Evidence: `READ-011`
- **[MEDIUM] Weak type safety with pervasive use of 'any' type** (effort M) — The article.service.ts file uses 'any' type extensively (buildFindAllQuery(query: any), createArticle(article: any), updateArticle(article: any)). This defeats TypeScript's type checking and makes refactoring risky. The codebase has TypeScript 5.2.2 and strict linting configured, but these type annotations are not enforced. This pattern appears across multiple service files and reduces the value of the type system for catching bugs at compile time.
  - Recommendation: Define explicit interfaces for article input, query parameters, and response objects. Use TypeScript's strict mode to enforce type safety. Replace 'any' with proper types (e.g., ArticleCreateInput, ArticleQuery). This will improve IDE support, catch errors earlier, and make the codebase more maintainable.
  - Evidence: `READ-011`, `READ-003`
- **[LOW] Minimal technical debt markers but one unresolved mock issue** (effort S) — Only one TODO/FIXME/HACK marker exists in the codebase (in tag.service.test.ts), indicating low accumulated technical debt. However, this single marker represents a blocking issue: the Prisma mock for tag.groupBy does not work, preventing the tag service test from being implemented. This is a concrete blocker rather than speculative debt.
  - Recommendation: Investigate and resolve the Prisma groupBy mocking issue. This may require updating jest-mock-extended, using a different mocking library, or refactoring the tag service to use a more mockable query pattern.
  - Evidence: `QUA-003`, `READ-004`
- **[INFO] Linting and formatting infrastructure in place** (effort S) — The project has ESLint and Prettier configured across three configuration files (.eslintrc.json, .prettierrc, e2e/.eslintrc.json) with TypeScript-specific rules (@typescript-eslint/eslint-plugin and parser at version 6.9.1). Jest is configured for unit testing with ts-jest and jest-mock-extended for mocking. This foundation is solid and reduces technical debt from style inconsistencies.
  - Recommendation: Maintain these configurations. Ensure linting runs in CI (currently absent per TEAM-001) to prevent regressions. Consider adding a pre-commit hook to enforce formatting.
  - Evidence: `QUA-002`, `READ-003`

### Security

- **[HIGH] Hardcoded JWT secret fallback in authentication middleware** (effort S) — The JWT authentication configuration in auth.ts and token.utils.ts uses a hardcoded fallback secret 'superSecret' when the JWT_SECRET environment variable is not set. This means tokens can be forged or validated using a known default secret if the environment variable is missing or misconfigured in production. The same pattern appears in both the token generation (token.utils.ts line 4) and JWT verification middleware (auth.ts lines 16 and 21).
  - Recommendation: Remove the hardcoded fallback secret and require JWT_SECRET to be explicitly set via environment variable. Fail fast at application startup if the variable is missing. Consider using a secrets management system (e.g., AWS Secrets Manager, HashiCorp Vault) for production deployments.
  - Evidence: `READ-014`, `READ-015`
- **[MEDIUM] Container runs as root user** (effort S) — The Dockerfile creates a non-root user 'api' and changes ownership of files to that user, but the CMD instruction does not include a USER directive to switch to the 'api' user before running the application. This means the Node.js process will execute as root, increasing the blast radius if the application is compromised.
  - Recommendation: Add 'USER api' directive before the CMD instruction in the Dockerfile to ensure the container runs with minimal privileges.
  - Evidence: `READ-005`, `SEC-001`
- **[MEDIUM] No automated dependency update mechanism** (effort S) — The repository has no Dependabot or Renovate configuration. With 11 runtime dependencies and 28 dev dependencies, security patches and updates must be managed manually. The codebase is dormant (last commit 995 days ago), increasing the risk that known vulnerabilities in dependencies are not being addressed.
  - Recommendation: Enable Dependabot (GitHub native) or Renovate to automatically detect and propose dependency updates. Configure it to create pull requests for security patches with high priority. Given the dormancy, conduct an immediate audit of all dependencies for known CVEs.
  - Evidence: `SEC-002`, `TEAM-003`
- **[MEDIUM] Weak password hashing configuration** (effort S) — The auth.service.ts uses bcryptjs with a salt rounds value of 10 (line 58: bcrypt.hash(password, 10)). While 10 is acceptable, modern best practice recommends 12 or higher for new implementations to account for increased computational power. This is a minor issue but worth addressing during any security hardening effort.
  - Recommendation: Increase bcryptjs salt rounds from 10 to 12 or higher. This provides better protection against brute-force attacks without significant performance impact for typical authentication flows.
  - Evidence: `READ-007`
- **[MEDIUM] CORS enabled without restriction** (effort S) — The main.ts file enables CORS with default settings (app.use(cors())) without specifying allowed origins. This permits cross-origin requests from any domain, which may expose the API to unauthorized access patterns or enable credential theft if sensitive data is returned.
  - Recommendation: Configure CORS to explicitly whitelist allowed origins. For example: cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'] }). Document and enforce this in environment configuration.
  - Evidence: `READ-016`
- **[LOW] Dependency versions pinned to caret ranges without lock discipline** (effort S) — The package.json uses caret (^) version ranges for most dependencies (e.g., express ~4.18.1, @prisma/client ^4.16.1), which allow minor and patch updates. While package-lock.json exists, the lack of automated dependency updates (SEC-002) combined with a dormant codebase means these ranges may pull in unvetted updates if dependencies are reinstalled.
  - Recommendation: Pair caret ranges with automated dependency update tooling (Dependabot/Renovate) to ensure updates are tested and reviewed. Alternatively, consider using exact pinning for production-critical dependencies.
  - Evidence: `READ-006`, `SEC-002`

### Cloud readiness

- **[HIGH] No infrastructure-as-code or deployment orchestration** (effort M) — The repository contains a Dockerfile but no infrastructure-as-code (Terraform, CloudFormation, Helm, Kubernetes manifests) or deployment orchestration (docker-compose, Kubernetes). Deployment requires manual steps: npm ci, prisma migrate deploy, and node execution. This creates friction for cloud migration and multi-environment consistency.
  - Recommendation: Create docker-compose.yml for local development and testing. Add Kubernetes manifests or Helm charts for production deployment. Document environment-specific configuration (dev, staging, prod) in IaC.
  - Evidence: `CLD-002`, `READ-029`
- **[HIGH] No observability instrumentation beyond console logging** (effort M) — The application uses only console.log/console.info for logging (4 instances found). There are no health check endpoints, readiness probes, liveness probes, or structured logging. No metrics collection (Prometheus, StatsD) or distributed tracing. This makes production monitoring, debugging, and orchestration difficult.
  - Recommendation: Implement structured logging (Winston, Pino, or Bunyan). Add /health and /ready endpoints for container orchestration. Integrate metrics collection (Prometheus client library). Consider adding request tracing middleware.
  - Evidence: `READ-027`, `READ-028`
- **[MEDIUM] 12-factor configuration partially implemented** (effort S) — Environment variables are used for PORT, HOST, DATABASE_URL, JWT_SECRET, and NODE_ENV (5 files confirmed). However, the README documents manual .env file creation for local development, and there is no validation of required environment variables at startup. Missing variables will cause runtime failures rather than fast-fail at boot.
  - Recommendation: Add environment variable validation at application startup using a library like joi or zod. Document all required and optional variables with defaults. Ensure the application fails fast with clear error messages if critical variables are missing.
  - Evidence: `CLD-003`, `READ-026`, `READ-025`
- **[MEDIUM] Manual database migration step required for deployment** (effort S) — Deployment requires manual execution of 'npx prisma migrate deploy' before starting the application. This is documented in README but not automated in the Dockerfile or deployment scripts. In containerized environments, this creates a race condition risk and requires careful orchestration.
  - Recommendation: Integrate database migrations into the container startup process or use an init container in Kubernetes. Alternatively, add a migration step to the Dockerfile entrypoint with proper error handling and rollback logic.
  - Evidence: `READ-026`, `READ-024`

### Team & process

- **[HIGH] Codebase dormant for nearly three years with no recent development activity** (effort M) — The repository has not received any commits in 995 days (last commit approximately 2.7 years ago). With 55 total commits by 16 contributors since 2016, the project shows minimal historical activity and is currently unmaintained. This poses significant risk for a production asset: no bug fixes, security patches, or dependency updates have been applied in nearly three years.
  - Recommendation: Before acquisition, assess whether this codebase will be actively maintained post-close. If yes, plan a comprehensive audit of dependencies (28 dev dependencies, 11 runtime) for known vulnerabilities and establish a maintenance schedule. If no, document the asset as legacy/archived and plan for eventual replacement or sunsetting.
  - Evidence: `TEAM-003`, `TEAM-005`
- **[HIGH] No continuous integration pipeline configured** (effort S) — The repository contains no CI configuration files (.github/workflows, .gitlab-ci.yml, .circleci, .travis.yml, or Jenkinsfile). While the project has npm scripts for build, test, and lint (defined in package.json), there is no automated pipeline to enforce code quality, run tests, or validate builds on commits. This is critical for a TypeScript/Express application with 36 source files and only 7 test files (19% coverage ratio).
  - Recommendation: Implement a CI pipeline (GitHub Actions, GitLab CI, or CircleCI) that runs on every commit: execute `npm ci && npm run lint && npm run test && npm run build`. This is essential before resuming active development and should be a pre-close requirement if the asset will be maintained.
  - Evidence: `TEAM-001`, `READ-031`, `READ-032`
- **[MEDIUM] Bus factor with top contributor responsible for one-third of commits** (effort M) — The top contributor authored 31% of the 55 total commits, and the bus factor is 2 (only two contributors account for a significant portion of the codebase). Combined with 995 days of inactivity, this indicates knowledge concentration and no active team to maintain or onboard new developers. The 16 contributors listed are historical; current team capacity is unknown.
  - Recommendation: Conduct interviews with the original top contributors to understand the codebase architecture, design decisions, and any undocumented patterns. Document critical paths and dependencies. Plan for knowledge transfer sessions if the asset will be retained and maintained.
  - Evidence: `TEAM-004`
- **[MEDIUM] Minimal onboarding documentation for a complex Express/Prisma application** (effort S) — The README (74 lines) covers basic setup (npm install, environment variables, Prisma generation, migrations, running the server) but lacks architectural documentation, API endpoint descriptions, database schema explanation, or development workflow guidance. For a 2,371-line TypeScript codebase with authentication, articles, comments, profiles, and tags, this is insufficient for new team members to understand the system design or contribute effectively.
  - Recommendation: Expand README with: (1) high-level architecture diagram or description; (2) API endpoint summary (auth, articles, comments, profiles, tags); (3) database schema overview; (4) development workflow (branching, testing, deployment); (5) troubleshooting section. Estimate 1–2 person-days to complete.
  - Evidence: `TEAM-002`, `READ-030`, `ARC-001`

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
- `READ-004` Inspected src/tests/services/tag.service.test.ts — src/tests/services/tag.service.test.ts
- `READ-005` Inspected Dockerfile — Dockerfile
- `READ-006` Inspected package.json — package.json
- `READ-007` Code search (36-char pattern): 20 matches — package.json, README.md, src/app/routes/auth/auth.service.ts
- `READ-008` Inspected src/main.ts — src/main.ts
- `READ-009` Inspected src/app/routes/routes.ts — src/app/routes/routes.ts
- `READ-010` Inspected nx.json — nx.json
- `READ-011` Inspected src/app/routes/article/article.service.ts — src/app/routes/article/article.service.ts
- `READ-012` Inspected src/app/routes/article/article.controller.ts — src/app/routes/article/article.controller.ts
- `READ-013` Code search (15-char pattern): 2 matches — src/tests/services/tag.service.test.ts
- `READ-014` Inspected src/app/routes/auth/auth.ts — src/app/routes/auth/auth.ts
- `READ-015` Inspected src/app/routes/auth/token.utils.ts — src/app/routes/auth/token.utils.ts
- `READ-016` Inspected src/main.ts — src/main.ts
- `READ-017` Inspected src/app/routes/article/article.service.ts — src/app/routes/article/article.service.ts
- `READ-018` Inspected src/prisma/schema.prisma — src/prisma/schema.prisma
- `READ-019` Inspected README.md — README.md
- `READ-020` Code search (18-char pattern): 20 matches — .eslintrc.json, .gitignore, .prettierignore, .vscode/extensions.json, e2e/jest.config.ts
- `READ-021` Code search (25-char pattern): 11 matches — .gitignore, e2e/src/support/test-setup.ts, README.md, src/app/routes/auth/auth.ts, src/app/routes/auth/token.utils.ts
- `READ-022` Inspected src/app/routes/article/article.controller.ts — src/app/routes/article/article.controller.ts
- `READ-023` Code search (52-char pattern): 30 matches — e2e/src/support/global-setup.ts, e2e/src/support/global-teardown.ts, e2e/src/support/test-setup.ts, src/app/routes/article/article.service.ts, src/app/routes/auth/auth.controller.ts
- `READ-024` Inspected Dockerfile — Dockerfile
- `READ-025` Inspected src/main.ts — src/main.ts
- `READ-026` Inspected README.md — README.md
- `READ-027` Code search (57-char pattern): 4 matches — e2e/src/support/global-setup.ts, e2e/src/support/global-teardown.ts, src/main.ts, src/prisma/seed.ts
- `READ-028` Code search (44-char pattern): 0 matches
- `READ-029` Code search (78-char pattern): 8 matches — Dockerfile, e2e/src/support/global-setup.ts, e2e/src/support/global-teardown.ts, project.json
- `READ-030` Inspected README.md — README.md
- `READ-031` Inspected package.json — package.json
- `READ-032` Code search (60-char pattern): 2 matches — .gitignore, README.md
- `READ-033` Inspected project.json — project.json

## Method

Scores are computed deterministically from the findings (critical −35, high −15, medium −6, low −2; any critical finding makes the dimension red). Every finding cites evidence from the scanners or from files the agents actually opened. 0 model findings were discarded for citing evidence that does not exist, and 4 findings were removed as cross-dimension duplicates. Critical and high scanner flags cannot be removed by the model. Cost: $0.1858 (147,337 tokens).
