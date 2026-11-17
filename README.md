# System Design Sandbox

An architecture editor with load simulation and an AI interviewer.

## Run locally

Requirements: Node (see `.nvmrc`), Corepack, and Docker.

```sh
corepack enable
cp .env.example .env
pnpm install
docker compose up -d
pnpm --filter api db:deploy   # apply database migrations
pnpm dev
```

### Sign-in (optional)

Without it the editor works in guest mode (localStorage only). Each provider is
enabled when its three `.env` values are set; the UI shows only enabled ones.

- **GitHub:** create an OAuth app at https://github.com/settings/developers with the
  callback URL `http://localhost:5173/api/auth/github/callback`, then set
  `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
- **Google:** create an OAuth client ("Web application") at
  https://console.cloud.google.com/apis/credentials with the redirect URI
  `http://localhost:5173/api/auth/google/callback`, then set
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Scripts

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Builds `@sds/shared`, then runs every app in watch mode |
| `pnpm build`     | Builds all packages in dependency order                 |
| `pnpm lint`      | ESLint across the monorepo                              |
| `pnpm typecheck` | `tsc` in every package                                  |
| `pnpm test`      | Vitest in every package (api: unit + e2e)               |

The API integration tests start their own Postgres with Testcontainers, so Docker
must be running. After changing `apps/api/prisma/schema.prisma`, run
`pnpm --filter api db:migrate --name <change>` to create a migration.

## API

Session cookie auth (GitHub or Google OAuth). All `/diagrams` routes require a session.

| Method   | Path                                      | What it does                                       |
| -------- | ----------------------------------------- | -------------------------------------------------- |
| `GET`    | `/auth/github`                            | Starts GitHub sign-in                              |
| `GET`    | `/auth/me`                                | `{ user }`, `null` when signed out                 |
| `POST`   | `/auth/logout`                            | Ends the session                                   |
| `GET`    | `/diagrams`                               | Lists your diagrams                                |
| `POST`   | `/diagrams`                               | Creates a diagram (version 1)                      |
| `GET`    | `/diagrams/:id`                           | Latest version with content                        |
| `PUT`    | `/diagrams/:id`                           | Saves a new version; 409 if `baseVersion` is stale |
| `DELETE` | `/diagrams/:id`                           | Deletes the diagram and its history                |
| `GET`    | `/diagrams/:id/versions`                  | Version history                                    |
| `POST`   | `/diagrams/:id/versions/:version/restore` | Copies an old version as the newest one            |

## Layout

- `apps/web`: React SPA (Vite)
- `apps/api`: NestJS API (Prisma + PostgreSQL)
- `packages/shared`: types shared by web and api (`@sds/shared`)
