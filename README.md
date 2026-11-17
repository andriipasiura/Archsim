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

`pnpm dev` starts the web app, the API and the simulator worker. To run the
simulator in a container instead, stop it in `pnpm dev` and use
`docker compose --profile simulator up -d --build simulator`.

### Server simulations

The simulation panel runs in the browser (Web Worker) by default. Signed-in users
can switch it to **Server**: the API enqueues a BullMQ job, `apps/simulator` steps
the same engine in real time and publishes each tick to Redis, and the API
streams the ticks to the browser over a WebSocket. The same seed and inputs give
the same ticks in both modes. Each user can run up to 2 server simulations at once.

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

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Builds the packages, then runs every app in watch mode |
| `pnpm build`     | Builds all packages in dependency order                |
| `pnpm lint`      | ESLint across the monorepo                             |
| `pnpm typecheck` | `tsc` in every package                                 |
| `pnpm test`      | Vitest in every package (api: unit + e2e)              |

The API and simulator integration tests start their own Postgres and Redis with
Testcontainers, so Docker must be running. After changing `apps/api/prisma/schema.prisma`, run
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

### `WS /simulations`

One connection runs one simulation, and it needs a session cookie. The client sends JSON
messages: `start { diagram, scenario, seed }`, then any number of
`diagram { diagram }` and `scenario { scenario }` updates. To stop, it closes the socket.
The server sends `tick { metrics }`, then either `done` or `error { message }`, and
then closes the socket. These types are defined in `packages/shared/src/simulation.ts`.

## Layout

- `apps/web`: React SPA (Vite)
- `apps/api`: NestJS API (Prisma + PostgreSQL, BullMQ + Redis, WebSocket)
- `apps/simulator`: BullMQ worker that runs simulations on the server
- `packages/sim-engine`: the simulation engine, pure TypeScript (`@sds/sim-engine`)
- `packages/shared`: types and schemas shared by every app (`@sds/shared`)
