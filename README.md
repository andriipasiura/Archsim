# System Design Sandbox

An architecture editor with load simulation and an AI interviewer.

## Run locally

Requirements: Node (see `.nvmrc`), Corepack, and Docker.

```sh
corepack enable
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

- Web: http://localhost:5173 (proxies `/api/*` to the API)
- API: http://localhost:3000/health

## Scripts

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Builds `@sds/shared`, then runs every app in watch mode |
| `pnpm build`     | Builds all packages in dependency order                 |
| `pnpm lint`      | ESLint across the monorepo                              |
| `pnpm typecheck` | `tsc` in every package                                  |
| `pnpm test`      | Vitest in every package (api: unit + e2e)               |

## Layout

- `apps/web`: React SPA (Vite)
- `apps/api`: NestJS API
- `packages/shared`: types shared by web and api (`@sds/shared`)
