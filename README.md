# Tasku

**Tasku** is a free, open-source, self-hostable project & issue tracker — an
alternative to Jira for teams who want to own their data.

> 🚧 **Status: planning.** No application code yet. The architecture and
> delivery plan live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Vision

Ship the core loop teams actually use every day — **project → board → issue →
status** — as a clean, typed, self-hostable app, then grow toward the parts of
Jira that matter most. The 80/20 rule drives the roadmap: roughly 20% of Jira's
features cover ~90% of daily usage.

## Planned stack

- **Frontend:** React + TypeScript + Vite, Tailwind, dnd-kit, TanStack Query
- **Backend:** NestJS + TypeScript, Prisma
- **Data:** PostgreSQL, Redis, S3-compatible storage (MinIO)
- **Architecture:** separate frontend SPA + stateless REST/WebSocket API

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data model, API
surface, complexity breakdown, and phased roadmap.

## Roadmap at a glance

| Phase | Focus |
|-------|-------|
| 0 | Monorepo, Docker, skeletons, CI |
| 1 | Auth, projects, roles |
| 2 | Issues + Kanban board (the core loop) |
| 3 | Sprints, backlog, epics, burndown |
| 4 | Labels, attachments, notifications, public API |
| 5+ | Long tail: JQL, custom fields, automation, SSO |

## License

Intended to be released under a permissive open-source license (MIT or
Apache-2.0).
