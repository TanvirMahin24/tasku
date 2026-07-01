# Task Ache — Feature Program Plan

Implementation plan for the requested feature set. **Build in waves**, review
between each. Grounded in the current Prisma schema (`apps/api/prisma/schema.prisma`)
and shared contract (`packages/types/src/index.ts`).

**Decisions (from the user):** build in waves · Delivery = **both** (Product
Discovery delivery-linking **and** releases/versions) · **Space = a project**
(reskin, not a new entity).

Legend: 🟢 mostly exists · 🟡 partial · 🔴 new build.

---

## Feature-by-feature analysis

### 1. Configurable statuses & values 🟢
- **Now:** Statuses are already per-project & fully configurable — `CreateStatusDto`,
  `UpdateStatusDto` (name, category, `wipLimit`), `ReorderStatusesDto`. Seed
  creates the current defaults.
- **Do:** Verify Settings UI exposes create/rename/reorder/delete + category + WIP
  (round out anything missing). Optionally add a **status color**. Ensure new
  projects seed the current default status set.
- **"Values":** interpreted as (a) the status set above + (b) selectable **options
  for custom SELECT fields** (Wave 2). _If you meant configurable priorities/types
  too, say so._

### 2. "Idea" issue type, above Epic 🔴
- **Now:** `IssueType = EPIC|STORY|TASK|BUG|SUBTASK`; hierarchy via `Issue.parentId`
  (no strict type rules).
- **Do:** Add `IDEA` to the enum (Prisma + types + `ISSUE_TYPES`). Define hierarchy
  order **Idea > Epic > Story/Task/Bug > Subtask** and enforce valid parent on
  create/move. Add type icon + color (`ui/icons.tsx`). Seed a sample Idea.

### 3. Custom fields with selectable types 🔴
- **Now:** none.
- **Do:** New models — `CustomFieldDefinition(projectId, name, type, options Json,
  required, order)` + `CustomFieldValue(issueId, fieldId, value Json)`.
  **Field types:** `TEXT, TEXTAREA, NUMBER, DATE, SELECT, MULTI_SELECT, CHECKBOX,
  USER, URL` (select/multi-select carry configurable option "values").
  API: CRUD defs (Settings), read/write values on issue. Render **beside default
  fields** in the issue drawer/page; edit inline. (List columns later.)

### 4. Hide time tracking from frontend 🟢
- **Now:** Worklogs + `originalEstimate`/`timeSpent` shown in issue detail; `worklogs`
  module + `Worklog` model.
- **Do:** Remove/hide the time-tracking UI (worklog panel, estimate/logged fields)
  from the issue drawer/page/list. **Keep** model + API intact.

### 5. Cross-board (cross-project) linked tasks 🟡
- **Now:** `IssueLink` is already cross-project at the DB level; `CreateLinkDto`
  links by global `targetKey`.
- **Do:** Make the link picker **search across all projects** (currently likely
  project-scoped), and render the other issue's project/board context.

### 6. Jira-like boards + star board 🟡
- **Now:** Multi-board per project (`Board`: type, teamId, filter, swimlanes,
  isDefault). No favorites.
- **Do:** New `BoardStar(userId, boardId)`; star/unstar toggle; "Starred" section
  in board switcher + Dashboard. Polish board list to feel Jira-like.

### 7. Delivery — **both** 🔴
- **7a. Releases/versions:** New `Version(projectId, name, description, releaseDate,
  released, startDate)` + many-to-many `Issue ↔ Version` (fixVersions). Releases
  page with per-version progress bars. Add to issue fields + Settings.
- **7b. Product-Discovery delivery-linking:** Link an **Idea** to delivery issues
  (epics/stories) via new `LinkType DELIVERS/DELIVERED_BY` (reuse `IssueLink`).
  Idea detail gets a **Delivery** tab: linked delivery tickets + **rollup**
  (% done from their status categories).

### 8. Dashboard page = Jira "/for-you" 🔴
- **Now:** none (project-scoped `Overview` exists; this is personal + cross-project).
- **Do:** New top-level **Dashboard** route + endpoint aggregating for the logged-in
  user: worked-on recently, assigned to me, starred boards/projects, recent
  projects, recent activity.

### 9. Spaces = project reskin 🟡
- **Now:** Projects exist; nav says "Projects".
- **Do:** Reskin/label the project concept as **"Spaces"** (nav + copy; keep routes/
  data). **Spaces page:** all of the logged-in user's tasks **across spaces** with
  filtering, plus **recommended spaces** (projects they're not a member of / suggested).

### 10. Realtime in-app notifications 🟡
- **Now:** `Notification` model + REST inbox; WS gateway exists (`events/`) but only
  emits `issue.*`, `comment.created`, `sprint.started` — **no notification event**,
  rooms are per-project.
- **Do:** Add **per-user** socket room; emit `notification.created` to the recipient
  on create; client shows toast + updates the bell/inbox live.

### 11. BlockNote rich-text editor 🔴
- **Now:** Description is a string (TipTap HTML/JSON), custom editor.
- **Do:** Swap issue **description** edit + view to **BlockNote** (`@blocknote/react`).
  Store BlockNote document JSON; import existing content via HTML. (Comments stay
  as-is unless you want them migrated too.)

---

## Waves (build order)

Ordered by risk and dependency (low-risk/foundational first; later waves depend on
earlier ones).

### Wave 1 — Quick wins & hierarchy _(low risk)_
- #4 Hide time tracking (frontend only).
- #2 Add **Idea** type + hierarchy rules + icon/color + seed.
- #6 **Star boards** (`BoardStar` + toggle + starred section).
- #5 Cross-project link picker.
- _One Prisma migration for the enum + `BoardStar`._

### Wave 2 — Configurable fields
- #1 Round out status config (+ optional color); defaults seed.
- #3 **Custom fields** (definitions with selectable types/options + issue values,
  rendered beside default fields).

### Wave 3 — Issue-detail experience
- #10 **Realtime notifications** (per-user WS room + `notification.created` + toast).
- #11 **BlockNote** editor/viewer for description.

### Wave 4 — Delivery
- #7a Releases/**versions** (model + fixVersions + Releases page).
- #7b **Delivery-linking** Idea → delivery tickets + rollup (needs Idea from W1).

### Wave 5 — Personal surfaces
- #8 **Dashboard** (/for-you clone; needs board stars from W1).
- #9 **Spaces** (project reskin + your-tasks-across-spaces + recommended spaces).

---

## Cross-cutting notes
- Every schema change → Prisma migration + regenerate client + update
  `packages/types` (the API contract) → both apps typecheck.
- New WS events → extend the `WsEvent` union in `packages/types`.
- Keep dark-mode parity and the UI-revamp direction (see `UI_REVAMP_BRIEF.md`) in
  mind for any new UI.
- Open interpretations flagged above (#1 "values", #11 comments) — correct me and
  I'll adjust the wave.
