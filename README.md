# AI Project Workspace Backend

NestJS backend foundation for the two-phase AI Project Workspace. Start with [AGENTS.md](AGENTS.md) for coding instructions and [PROJECT_IMPLEMENTATION_GUIDE.md](PROJECT_IMPLEMENTATION_GUIDE.md) for the complete roadmap.

## What exists

- NestJS 11, Express, strict TypeScript, TypeORM, PostgreSQL/pgvector.
- Validated environment configuration; structured Pino logging; request IDs; safe errors; Helmet; explicit-origin CORS; global DTO validation.
- Health endpoints, Swagger UI, and offline OpenAPI generation.
- Explicit migration workflow, isolated database tests, Docker Compose, and a GitHub Actions CI workflow.
- Pinned Node/pnpm versions and a pnpm lockfile.

Authentication, project CRUD, document upload, frontend, AI generation, embeddings, and GitHub integration are **not implemented yet**. The next milestone is **P1-01: Accounts and sessions**. Only health endpoints are intentionally public. Do not publish this foundation as a finished product.

DeepSeek V4 Pro is the selected LLM for Phase 2. The `.env.example` reserves its settings; no provider SDK or paid API calls are enabled. Embeddings have separate recommended provider settings. Enabling AI/GitHub early fails configuration validation instead of pretending those integrations work.

## Prerequisites

- Node.js **24.14.0**, as pinned in `.node-version`.
- pnpm **10.32.1**, as pinned in `package.json` (`npm install --global pnpm@10.32.1` if needed).
- Docker with Compose and a running Docker engine.

NestJS 11 is pinned for the CommonJS/Jest toolchain; `@nestjs/config` is pinned at v4 because v12 is ESM-only. TypeScript 5.9 and TypeORM 0.3 are also pinned to keep the toolchain compatible. You do not need a global Nest CLI.

## Start local development

Run from this repository. On first setup only, copy the environment example:

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm db:up
pnpm migration:run
pnpm dev
```

On macOS/Linux, use `cp .env.example .env`. Do not overwrite an existing configured `.env` during later updates. The initial setup task already creates the local `.env` and installs dependencies.

- API liveness: [http://localhost:3000/api/v1/health/live](http://localhost:3000/api/v1/health/live)
- API readiness: [http://localhost:3000/api/v1/health/ready](http://localhost:3000/api/v1/health/ready)
- Swagger UI (local development): [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- Runtime OpenAPI JSON: [http://localhost:3000/api/docs-json](http://localhost:3000/api/docs-json)

The project defaults to port **3000**. Host development PostgreSQL is on **55432**. Update `.env` deliberately if local ports change; Compose has explicit mappings and does not inherit all `.env` runtime values.

There is no root `/` page; use the routes above. A successful response is `{"data":{"status":"ok"}}`. Readiness checks PostgreSQL and a temporary write/delete probe under local upload storage; it returns a generic 503 if either is unavailable. The API currently requires the database at startup. After startup, database failure causes readiness to fail while liveness remains available.

## Run the containerized local stack

```powershell
pnpm stack:up
```

This builds the API image, starts PostgreSQL, runs migrations in a one-shot release container, then starts the API on port 3000. Do not run `pnpm dev` on the same port simultaneously. To switch to host development:

```powershell
docker compose --profile app stop api
pnpm dev
```

Stop only this project's containers with `pnpm stack:stop`. Development database and upload named volumes persist. The test database uses tmpfs and loses its contents when its container stops. Avoid `docker compose down -v` unless intentionally deleting this project's development data.

Compose is a **local demo/development configuration**: credentials are public local-only values, ports bind loopback, and Swagger is enabled. The image defaults to production mode, which disables public Swagger. A production deployment still needs private credentials, a least-privilege runtime database role, a separate migration role, TLS, restricted networking, backups, and deployment-specific storage. No cloud deployment has been created.

## Commands

| Command                                      | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                                   | Watch/restart the TypeScript API                                  |
| `pnpm build`                                 | Compile application into `dist/`                                  |
| `pnpm start:prod`                            | Run compiled API; configuration still comes from environment/.env |
| `pnpm lint`                                  | ESLint, including promise handling                                |
| `pnpm typecheck`                             | Check application, scripts, and tests                             |
| `pnpm format:check` / `pnpm format`          | Check/apply Prettier                                              |
| `pnpm test`                                  | Unit tests, no database                                           |
| `pnpm test:e2e`                              | HTTP infrastructure tests with fake database, no Docker required  |
| `pnpm db:test:up`                            | Start isolated PostgreSQL test service on 55433                   |
| `pnpm test:integration`                      | Real PostgreSQL/pgvector migration tests                          |
| `pnpm migration:run` / `pnpm migration:show` | Explicitly apply/list development migrations                      |
| `pnpm migration:run:prod`                    | Apply compiled migrations in release environment                  |
| `pnpm openapi:generate`                      | Write `docs/openapi.json` without database or API keys            |

To generate a migration after editing entities:

```powershell
pnpm migration:generate src/database/migrations/DescribeTheChange
```

Inspect generated SQL before running it. There is no automatic schema synchronization or startup migration. The initial migration enables `vector`; its rollback intentionally refuses automatic extension deletion because later columns could depend on it. No user or project seed exists until those entities are implemented.

The OpenAPI generator currently registers only health controllers in a metadata-only module. Add new controllers there as endpoints are implemented, and compare generated paths with the runtime document. Do not generate fake operations from the future endpoint inventory.

## Verify changes

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:test:up
pnpm test:integration
pnpm build
pnpm openapi:generate
```

Integration tests read `TEST_DATABASE_URL`, require a database name ending in `_test`, and reject the development URL. They apply migrations and verify pgvector plus idempotent replay. Never change that URL to shared or production data. Tests do not drop the database. HTTP tests use isolated temporary storage and a fake database; a passing HTTP suite alone is not real database verification.

The CI workflow repeats these checks, checks for OpenAPI drift, and builds the Docker image. It will run after the repository is pushed to GitHub; local verification does not mean remote CI has run.

## Structure

```text
src/
  config/                    # Validated environment
  common/                    # HTTP setup and error handling
  database/                  # TypeORM options, CLI data source, migrations
  modules/health/             # Only implemented feature module so far
  app.module.ts
  main.ts
  openapi.ts
scripts/                     # Offline OpenAPI and guarded integration runner
test/{unit,e2e,integration}/
docs/openapi.json             # Actual generated contract
.github/workflows/ci.yml
```

Do not put domain business logic in `common`. Add feature modules with their DTOs, services, entities, policies, and behavior tests as the guide's milestones progress.

## Troubleshooting

- **Docker connection failure:** start Docker Desktop/the Docker engine, then rerun `pnpm db:up`.
- **Port already allocated:** inspect the owner; stop only this project's API if switching execution mode, or choose another local port. Do not terminate unrelated work.
- **Database connection refused:** confirm `pnpm db:up` passed and `.env` uses port 55432 for host execution; container execution uses hostname `postgres` and port 5432.
- **Invalid environment configuration:** the error identifies invalid fields without printing their values. Check exact `true`/`false`, valid URLs/ports, and keep Phase 2 flags false.
- **Migration permission denied:** extension setup needs an appropriate migration role; do not enable `synchronize` to bypass migrations.
- **Readiness 503:** check database availability and local storage permissions. Detailed credentials/paths are intentionally omitted from public responses.
- **PowerShell script execution restrictions:** use `pnpm.cmd` instead of `pnpm`; do not weaken machine-wide execution policy.
