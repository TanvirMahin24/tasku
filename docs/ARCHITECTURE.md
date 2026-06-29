# Tasku — Architecture & Roadmap

> **Tasku** is a free, open-source project & issue tracker — a self-hostable
> alternative to Jira. This document is the plan: the system architecture, data
> model, API surface, and a phased delivery roadmap. No application code yet —
> this is the blueprint we build against.

---

## 1. Guiding principles

1. **80/20 first.** ~20% of Jira's features cover ~90% of daily usage. Ship the
   core loop (project → board → issue → status) before the long tail.
2. **Self-hostable & open.** Runs on a single Postgres + two containers. No
   proprietary services required. MIT/Apache-2.0 licensed.
3. **Separate frontend and backend.** A React SPA talks to a stateless REST/WS
   API. Either can be deployed, scaled, and reasoned about independently.
4. **Typed end-to-end.** TypeScript on both sides; a shared package of types so
   the contract can't silently drift.
5. **Boring, durable tech.** Postgres, Prisma, React. Optimize for
   contributor onboarding, not novelty.

---

## 2. High-level architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│         Frontend            │  HTTPS  │           Backend            │
│  React + TS + Vite (SPA)    │ ──────► │  NestJS (REST + WebSocket)   │
│  Tailwind, dnd-kit,         │  WSS    │  Prisma ORM                  │
│  TanStack Query, Zustand    │ ◄────── │  JWT auth, RBAC guard        │
└─────────────────────────────┘         └──────────────┬───────────────┘
                                                        │
                                  ┌─────────────────────┼─────────────────────┐
                                  │                     │                     │
                            ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐
                            │ Postgres  │         │   Redis   │         │  Object   │
                            │ (primary) │         │ (cache /  │         │  storage  │
                            │           │         │  pub-sub) │         │ (S3/MinIO)│
                            └───────────┘         └───────────┘         └───────────┘
```

- **Frontend** — Single-page React app. No SSR needed for an authenticated
  internal tool; keeps the deployment trivial (static files behind any CDN).
- **Backend** — NestJS gives us modules, dependency injection, guards
  (clean fit for RBAC), and first-class WebSocket support, without hand-rolling
  the structure an app this size needs.
- **Postgres** — Source of truth. Relational model fits issues/projects/links
  naturally; JSONB columns absorb custom-field flexibility later.
- **Redis** — Caches hot reads and acts as the pub/sub backbone so board
  updates fan out across multiple backend instances.
- **Object storage** — Attachments. S3-compatible (MinIO for self-host).

### Repository layout (monorepo)

```
tasku/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── api/          # NestJS backend
├── packages/
│   ├── types/        # Shared TS types / DTOs / Zod schemas
│   └── config/       # Shared eslint, tsconfig, prettier
├── docs/
└── docker-compose.yml
```

Tooling: **pnpm workspaces** + **Turborepo** for task orchestration and caching.

---

## 3. Tech stack

### Frontend (`apps/web`)
| Concern            | Choice                          | Why                                         |
|--------------------|---------------------------------|---------------------------------------------|
| Framework          | React 18 + TypeScript           | Ubiquitous, huge contributor pool           |
| Build              | Vite                            | Fast dev server, simple SPA builds          |
| Styling            | Tailwind CSS                    | Velocity, consistency, no CSS bikeshedding  |
| Component base     | Radix UI primitives             | Accessible, unstyled, composable            |
| Server state       | TanStack Query                  | Caching, mutations, optimistic updates      |
| Client state       | Zustand                         | Lightweight UI/board state                  |
| Drag & drop        | dnd-kit                         | Modern, accessible, performant boards       |
| Forms              | React Hook Form + Zod           | Validation shared with backend              |
| Routing            | React Router                    | Standard SPA routing                        |
| Rich text          | TipTap (ProseMirror)            | Issue descriptions, comments, @mentions     |
| Realtime           | native WebSocket / socket.io    | Live board & notification updates           |

### Backend (`apps/api`)
| Concern            | Choice                          | Why                                         |
|--------------------|---------------------------------|---------------------------------------------|
| Framework          | NestJS + TypeScript             | Structure, DI, guards, WS support           |
| ORM                | Prisma                          | Type-safe queries, painless migrations      |
| DB                 | PostgreSQL 16                   | Relational + JSONB for custom fields        |
| Cache / pub-sub    | Redis                           | Sessions, caching, multi-node WS fan-out    |
| Auth               | JWT (access + refresh) / Auth.js| Stateless, SSO-extensible                   |
| Validation         | Zod (shared) / class-validator  | One source of truth for shapes              |
| Files              | S3-compatible (MinIO)           | Self-hostable attachments                   |
| Background jobs    | BullMQ (on Redis)               | Notifications, emails, automation rules     |
| API docs           | OpenAPI / Swagger               | Auto-generated, drives the public REST API  |

---

## 4. Data model (core entities)

```
User ──< ProjectMember >── Project ──< Issue
                              │           │
                              │           ├──< Comment
                              │           ├──< Attachment
                              │           ├──< IssueLabel >── Label
                              │           ├──< IssueLink (blocks/relates/duplicates)
                              │           └──< ActivityLog
                              │
                              ├──< Workflow ──< Status (column)
                              ├──< Sprint
                              └──< Epic
```

### Key tables (illustrative, not final schema)

**User** — `id, email, passwordHash, displayName, avatarUrl, createdAt`

**Project** — `id, key (e.g. TASK), name, description, leadId, createdAt`
- `key` is the human prefix for issue identifiers (`TASK-42`).

**ProjectMember** — `id, projectId, userId, role (ADMIN|MEMBER|VIEWER)`

**Issue** — the heart of the system:
```
id, projectId, key (TASK-42), seq (per-project counter),
type (STORY|BUG|TASK|EPIC|SUBTASK),
title, description (rich text JSON),
statusId, priority (LOWEST..HIGHEST),
reporterId, assigneeId,
parentId (epic/subtask hierarchy),
sprintId, storyPoints,
rank (lexorank for ordering on board),
customFields (JSONB),
createdAt, updatedAt
```

**Status / Workflow** — a project has a Workflow; a Workflow has ordered
Statuses (the board columns) and allowed Transitions between them.

**Sprint** — `id, projectId, name, goal, startDate, endDate, state (FUTURE|ACTIVE|CLOSED)`

**Comment** — `id, issueId, authorId, body (rich text), createdAt`

**ActivityLog** — append-only audit trail of every issue change (field, old, new, actor, timestamp). Powers the issue history view and notifications.

**Label / IssueLabel**, **Attachment**, **IssueLink**, **Notification** round out the set.

### Ordering note — board rank
Board ordering uses a **lexorank**-style string rank so a card can be dropped
between two others without renumbering the column. This is the single most
important detail for a smooth drag-and-drop board and is easy to get wrong if
left as an integer `position`.

---

## 5. API surface (REST + WebSocket)

REST under `/api/v1`, JWT-authenticated, documented via OpenAPI.

```
Auth        POST   /auth/register      POST /auth/login
            POST   /auth/refresh       POST /auth/logout
            GET    /auth/me

Projects    GET    /projects           POST   /projects
            GET    /projects/:key      PATCH  /projects/:key   DELETE …
            GET    /projects/:key/members   POST /projects/:key/members

Issues      GET    /projects/:key/issues        (filter, paginate, search)
            POST   /projects/:key/issues
            GET    /issues/:issueKey
            PATCH  /issues/:issueKey            (status, assignee, fields…)
            DELETE /issues/:issueKey
            POST   /issues/:issueKey/transition  { toStatusId }
            POST   /issues/:issueKey/rank        { afterId | beforeId }

Comments    GET/POST  /issues/:issueKey/comments     PATCH/DELETE /comments/:id
Attachments POST      /issues/:issueKey/attachments   (presigned upload)
Board       GET    /projects/:key/board             (columns + ranked cards)
Sprints     GET/POST  /projects/:key/sprints   POST /sprints/:id/start | /complete
Search      GET    /search?q=…                       (later: JQL-lite)
```

**WebSocket** (`/ws`, room per project): `issue.created`, `issue.updated`,
`issue.moved`, `comment.created`, `sprint.started` → clients reconcile their
TanStack Query cache live. No polling.

---

## 6. Complexity tiers (what we are and aren't building)

| Tier | Scope | Effort | Verdict |
|------|-------|--------|---------|
| **1 — Core MVP** | Auth, projects, issues, Kanban board (drag-drop), comments, activity log, basic filter | Weeks | **Build first** |
| **2 — Real Jira feel** | Sprints/backlog, epics & subtasks, configurable workflows, labels/components, attachments, @mentions & notifications, story points, burndown | Weeks–months | **Build next** |
| **3 — Long tail** | JQL engine, custom fields/types UI, permission schemes, automation-rules engine, plugin API, dashboards/reports, webhooks, SSO/SAML, multi-tenancy | Months–years | **Defer / pick selectively** |

The hard, genuinely-expensive parts of Jira all live in Tier 3 — **JQL** (a real
query language: lexer, parser, evaluator), the **permission scheme** engine, and
the **automation** engine. None are needed to be useful; each is a project in its
own right. We design the data model so they *can* be added (JSONB custom fields,
role-based guards, an activity stream automation can hook into) without committing
to them now.

---

## 7. Delivery roadmap

### Phase 0 — Foundations
- Monorepo scaffold (pnpm + Turborepo), shared `types`/`config` packages
- `docker-compose` (Postgres, Redis, MinIO), `.env` conventions
- NestJS skeleton + Prisma schema + first migration
- Vite/React skeleton, Tailwind, routing shell, auth pages
- CI: lint, typecheck, test on every PR

### Phase 1 — Auth & projects
- Register/login/refresh, JWT guard, `/auth/me`
- Project CRUD, members & roles (RBAC guard)
- App shell: sidebar, project switcher, protected routes

### Phase 2 — Issues & the board (the core loop)
- Issue CRUD with per-project `KEY-seq` numbering
- Kanban board with dnd-kit + lexorank ranking
- Status transitions, assignee/priority, issue detail drawer
- Comments + rich text (TipTap), activity log
- Live updates over WebSocket

### Phase 3 — Agile layer
- Backlog view, sprints (create/start/complete)
- Epics & subtasks, story points, swimlanes
- Burndown chart

### Phase 4 — Polish & extensibility
- Labels/components, attachments, @mention notifications
- Saved filters + search (precursor to JQL-lite)
- Configurable workflows UI
- OpenAPI-documented public REST API + webhooks

### Phase 5+ — Long tail (opt-in)
- JQL-lite → JQL, custom fields UI, permission schemes,
  automation rules, dashboards, SSO. Tackle by demand.

---

## 8. Non-functional concerns

- **Testing** — Vitest (unit) + Playwright (e2e for the board flows). Seed
  scripts for realistic demo data.
- **Security** — bcrypt/argon2 password hashing, rate-limited auth, RBAC on
  every mutation, signed presigned upload URLs, input validation at the edge.
- **Observability** — structured logging (pino), health endpoints, optional
  OpenTelemetry traces.
- **Deployment** — one `docker-compose up` for self-host; Helm chart later.
  Frontend ships as static assets; backend as a stateless container scaled
  behind Redis-backed WS fan-out.

---

## 9. Immediate next step

Phase 0 — scaffold the monorepo and stand up the Postgres/Redis/MinIO
`docker-compose`, the NestJS skeleton with the Prisma schema above, and the
Vite/React shell. That gives a running (empty) app to build every later phase
on top of.
