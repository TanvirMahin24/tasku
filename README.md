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

## API at a glance

REST under `/api/v1` (JWT in `Authorization: Bearer …`), plus a WebSocket
gateway for live board/comment/sprint events.

```
POST /auth/register | /auth/login        GET /auth/me        GET /users
GET/POST /projects                        GET/PATCH/DELETE /projects/:key
GET /projects/:key/board | /statuses | /labels | /sprints | /members
GET/POST /projects/:key/issues            GET/PATCH/DELETE /issues/:issueKey
POST /issues/:issueKey/move               GET/POST /issues/:issueKey/comments
POST /projects/:key/sprints               POST /sprints/:id/start | /complete
GET /notifications                        POST /notifications/:id/read | /read-all
```

## Roadmap (next)

Tier 3 / long tail, tackled by demand: JQL search, custom fields & issue types,
permission schemes, an automation-rules engine, dashboards/reports, webhooks,
and SSO. The data model is built to absorb these without a rewrite.

## License

MIT.
