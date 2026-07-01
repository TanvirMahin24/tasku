# Tasku

**Tasku** is a free, open-source, self-hostable project & issue tracker — an
alternative to Jira for teams who want to own their data.

It implements the day-to-day core of Jira: projects, issues, a drag-and-drop
Kanban board, sprints & backlog, epics/subtasks, comments, activity history,
labels, story points, @mentions, notifications, and live updates — as a clean,
fully-typed React + NestJS app you can run yourself.

## Features

**Tier 1 — core**
- Email/password auth (JWT), users
- Projects with keys (`TASK-1`, `TASK-2`, …) and role-based membership (Admin/Member/Viewer)
- Issues: types (Epic/Story/Task/Bug/Subtask), priority, assignee/reporter, rich description
- **Kanban board** with drag-and-drop across columns (lexorank ordering, optimistic updates)
- Comments + full per-field **activity log** (who changed what, when)
- Filtering & search

**Tier 2 — "real Jira feel"**
- **Sprints & backlog** — create/start/complete sprints; incomplete issues roll back to the backlog
- **Epics & subtasks** (issue hierarchy)
- Configurable statuses/workflow per project (board columns)
- **Labels** & components, **story points**
- **@mentions** and a notifications inbox (assigned / mentioned / commented / status-changed)
- **Live updates** over WebSocket (board, comments, sprints)
- Sprint report with a lightweight burndown/points view

**Tier 2.5 — Jira-style views & org**
- **Teams** — global teams with members & roles, assignable to issues and boards
- **Multiple boards per project** — a default board plus team-scoped / filtered boards (filter by assignee, label, type, priority), with a board switcher
- **List view** — a dense, sortable, filterable table of all issues
- **Timeline / roadmap** — a Gantt view of epics and scheduled work over time (start/due dates), with an "unscheduled" tray
- **Overview dashboard** — totals, story-point progress, status/type/priority breakdowns, per-assignee workload, and a recent-activity feed
- **Sub-task / parent / child** — create subtasks from an issue; parent & child links in the issue drawer

**Power features**
- **Search & saved filters** — cross-project issue search, a criteria builder, reusable saved filters, and a ⌘K command palette
- **Issue links / dependencies** — blocks / is-blocked-by / relates-to / duplicates, shown in the issue drawer
- **Attachments** — file uploads on issues (image thumbnails, download, delete)
- **Watchers** — watch/unwatch issues; watchers get notified on comments & changes
- **Time tracking** — original estimate, logged-time worklogs, and a progress bar
- **Bulk edit** — multi-select issues on the List view and change status/assignee/priority/team/sprint/labels at once
- **Reports** — velocity, burndown, cumulative-flow, and created-vs-resolved charts

## Tech stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 + TypeScript, Vite, Tailwind, TanStack Query, Zustand, dnd-kit, socket.io-client |
| Backend  | NestJS 10 + TypeScript, Prisma, JWT/Passport, socket.io |
| Data     | PostgreSQL, Redis (optional, for multi-node WS fan-out) |
| Shared   | `@tasku/types` — a workspace package of DTOs/enums shared by both apps |

Monorepo via npm workspaces. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the full data model, API surface, and design notes.

## Project structure

```
tasku/
├── apps/
│   ├── api/      # NestJS REST + WebSocket API (Prisma, auth, modules)
│   └── web/      # React + Vite SPA
├── packages/
│   └── types/    # Shared TypeScript DTOs/enums (the API contract)
├── docs/ARCHITECTURE.md
└── docker-compose.yml   # Postgres + Redis
```

## Quick start

**Prerequisites:** Node ≥ 20, and a PostgreSQL database (use the bundled
`docker-compose.yml`, or any Postgres you have).

```bash
# 1. Install dependencies (also runs `prisma generate`)
npm install

# 2. Start Postgres (and Redis) — or point DATABASE_URL at your own
docker compose up -d

# 3. Configure env
cp apps/api/.env.example apps/api/.env      # DATABASE_URL, JWT_SECRET, PORT
cp apps/web/.env.example apps/web/.env      # VITE_API_URL, VITE_WS_URL

# 4. Create the schema and load demo data
npm run db:migrate        # applies migrations to the database
npm run db:seed           # seeds demo project, users, issues, sprints

# 5. Run both apps (API on :4000, web on :5173)
npm run dev
```

Then open **http://localhost:5173**.

### Demo logins (from the seed)

| Email             | Password   |
|-------------------|------------|
| alice@tasku.dev   | `password` |
| bob@tasku.dev     | `password` |
| carol@tasku.dev   | `password` |

The seed creates a **TASK** project with statuses, labels, two sprints (one
active), and a handful of issues across types and columns.

## Useful scripts (run from the repo root)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run API + web together |
| `npm run build` | Build types → api → web |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:generate` | Regenerate the Prisma client |

## Troubleshooting

- **`Cannot find module .../apps/api/dist/main`** when running `dev`: a stale or
  partial build. Clean and rebuild:
  ```bash
  rm -rf apps/api/dist apps/api/*.tsbuildinfo
  npm run build -w @tasku/api
  ```
  If `--watch` still races on a cold start, run the API and web in two terminals
  (`pnpm --filter @tasku/api start` after a build, and `pnpm --filter @tasku/web dev`).
- **Using `pnpm`?** pnpm doesn't run dependencies' build scripts by default, so
  Prisma's engine/client won't be generated and the API won't start. This repo
  allow-lists them via `pnpm.onlyBuiltDependencies`; if you still see a Prisma
  "did you forget to run generate" error, run `pnpm --filter @tasku/api exec prisma generate`.
  (An `apps/api` `postinstall` also runs `prisma generate` automatically.)
- **Recommended Node:** 20 or 22 LTS. Very new majors can trip nest's watch mode.
- **Reset the database** (drops + re-migrates + re-seeds): `npm run db:reset -w @tasku/api`.

## API at a glance

REST under `/api/v1` (JWT in `Authorization: Bearer …`), plus a WebSocket
gateway for live board/comment/sprint events.

```
POST /auth/register | /auth/login        GET /auth/me        GET /users
GET/POST /projects                        GET/PATCH/DELETE /projects/:key
GET /projects/:key/board | /statuses | /labels | /sprints | /members
GET/POST /projects/:key/issues            GET/PATCH/DELETE /issues/:issueKey
POST /issues/:issueKey/move               GET/POST /issues/:issueKey/comments
POST /issues/:issueKey/subtasks           GET /projects/:key/timeline | /overview
GET/POST /projects/:key/boards            GET/PATCH/DELETE /boards/:id   GET /boards/:id/board
GET/POST /teams                           GET/PATCH/DELETE /teams/:id    POST/DELETE /teams/:id/members
POST /projects/:key/sprints               POST /sprints/:id/start | /complete
GET /notifications                        POST /notifications/:id/read | /read-all
GET /search/issues                        GET/POST /filters   GET/PATCH/DELETE /filters/:id   GET /filters/:id/results
POST /issues/:key/links                   DELETE /links/:id
POST/DELETE /issues/:key/watch            POST /issues/:key/worklogs   DELETE /worklogs/:id
POST /issues/:key/attachments             GET /attachments/:id/raw     DELETE /attachments/:id
POST /projects/:key/issues/bulk           GET /projects/:key/reports
```

## Roadmap (next)

Tier 3 / long tail, tackled by demand: JQL search, custom fields & issue types,
permission schemes, an automation-rules engine, dashboards/reports, webhooks,
and SSO. The data model is built to absorb these without a rewrite.

## License

MIT.
