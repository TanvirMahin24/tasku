# Task Ache — UI Revamp Brief

A design brief for a full visual rebrand of the **Task Ache** web app (formerly
"Tasku"). Hand this to a designer (human or AI). It captures **what Task Ache
is**, the **current UI**, the **technical constraints the redesign must
respect**, and the **deliverables** expected back.

> **Naming:** the product is being renamed **Tasku → Task Ache** as part of this
> rebrand. "Task Ache" is a deliberate two-word wordmark — design the logo and
> auth first-impression around the new name. Code identifiers (`@tasku/*`
> packages, the `tasku` repo) are **not** in scope for this doc; keep referring
> to them as-is when pointing at files.

---

## 1. Mandate (decided)

| Decision | Choice |
|----------|--------|
| **Scope** | **Full rebrand** — new visual identity: colors, type, spacing, depth, component look. Layout/IA may change where it improves the product. |
| **Aesthetic** | **Jira / Atlassian-familiar** — conventional PM-tool feel. Migrants from Jira should feel at home: colorful issue-type semantics, clear board chrome, recognizable patterns. Modern and clean, not a 2015 Jira clone. |
| **Brand color** | **Open to change.** Current primary is indigo `#6366f1`. Designer may propose a new primary + accent ramp. Whatever is chosen must ship as a Tailwind color scale (50–900). |

Everything else below is context and constraints.

---

## 2. Product context

**Task Ache** — free, open-source, self-hostable project & issue tracker. A Jira
alternative for teams who want to own their data. Audience: **developers and
software teams**. It implements the day-to-day core of Jira: projects, issues,
a drag-and-drop Kanban board, sprints & backlog, epics/subtasks, comments,
activity history, labels, story points, @mentions, notifications, live updates.

Tone: professional, efficient, keyboard-friendly, trustworthy. Not playful, not
enterprise-stuffy. Think **Linear's craft with Jira's information model**.

---

## 3. Technical constraints — the redesign MUST stay implementable

This is a real React app, not a Figma-only concept. The redesign has to map onto
the existing stack. **Do not propose anything that can't be expressed here:**

- **React 18 + TypeScript + Vite** SPA.
- **Tailwind CSS** for all styling. Tokens live in `apps/web/tailwind.config.js`
  (`theme.extend.colors`) and `apps/web/src/index.css` (`@layer` component
  tokens). Deliver the new design **as Tailwind tokens + utility classes**, not
  bespoke CSS files.
- **Dark mode is class-based and first-class** (`darkMode: 'class'`, toggled on
  `<html>`). Three modes: **light / dark / system**. Every screen, token, and
  component spec must define **both light and dark** values. This is non-negotiable.
- **Icons: `lucide-react`.** Stay within lucide's set (or specify SVGs to add).
- **`clsx`** for conditional classes. Variants are plain class maps (see Button).
- **Drag & drop: `@dnd-kit`** on the board — card and column visuals can change,
  but keep drag handles/affordances workable.
- **Data: TanStack Query**; **live updates via socket.io** (board, comments,
  sprints update in real time). Design needs **loading, empty, error, and
  optimistic/updating states** for data-driven views.
- **Routing: react-router** — the route/IA map in §6 is the current structure.

**Keep implementable = keep it in Tailwind, keep dark mode, keep lucide, don't
break dnd/board interaction.**

---

## 4. Current design system (the baseline being replaced)

Snapshot of what exists today, so you know what you're rebranding away from.

### Color
- **Brand:** indigo ramp `50→900` (primary `brand-600 #4f46e5`, base `#6366f1`).
- **Neutrals:** Tailwind `gray` scale throughout.
- **Semantic:** `red` for danger/destructive; label/team colors are arbitrary
  user-chosen hex (rendered as pills with auto-contrast text).

### Surface tokens (defined in `index.css`)
| Token | Light | Dark |
|-------|-------|------|
| `.surface` | `white` | `gray-900` |
| `.surface-muted` | `gray-50` | `gray-950` |
| `.surface-raised` | `white` | `gray-800` |
| `.field` (inputs) | white, `gray-300` border, `brand-500` focus ring | `gray-800`, `gray-600` border |
| App background | `gray-50` | `gray-950` |
| Borders (global) | `gray-200` | `gray-700` |

### Type
- System sans stack (`ui-sans-serif, system-ui, -apple-system, Segoe UI…`).
- No custom typeface. Sizes are Tailwind defaults; UI is **dense** (lots of
  `text-xs` / `text-sm`, `text-[11px]` pills).

### Shape & depth
- Radius: `rounded-md` default, `rounded-lg` on cards, full pills on badges.
- Elevation: `shadow-sm` on cards, `shadow-xl` on popovers. Flat overall.

### Components (current look)
- **Button** — 5 variants (`primary` solid brand, `secondary` outline, `ghost`,
  `subtle` gray, `danger` red), 3 sizes (`h-7 / h-9 / h-11`), `rounded-md`,
  focus-visible ring, loading spinner slot.
- **Badge / LabelBadge** — tiny `text-[11px]` pills; custom hex bg with
  auto-contrast text.
- Also: Avatar, Chip, Select, AssigneeSelect, LabelPicker, Modal, PageHeader,
  Spinner, TeamChip, issue-type/priority icons.

**Overall current impression:** competent but generic "indigo-on-gray dev tool."
Flat, dense, low-personality. The rebrand should give it a **distinct, Jira-familiar
identity** with clearer hierarchy and more polished states.

---

## 5. App shell / layout (current)

- **Fixed left sidebar, 240px (`w-60`), dark (`gray-900`)** regardless of theme.
  Contains: logo (currently "Tasku" + check icon in brand square — becomes the
  new **Task Ache** wordmark), **project switcher**
  (dropdown), primary nav, then a **project-scoped nav section** when inside a
  project, and a **footer** (notifications bell · theme toggle · user avatar/name
  · sign-out).
- **Main content area:** each page renders its own `PageHeader` + body. Scrolls
  independently.
- **Global ⌘K / Ctrl-K command palette** (search + navigation).

Nav structure:
- Top level: **Search (⌘K)**, **Projects**, **Teams**.
- Project-scoped: **Overview · Board · List · Timeline · Backlog · Sprint report
  · Reports · Settings**.

The dark-sidebar-always pattern, the switcher, and the footer cluster are all
open to redesign — but the **information architecture (what's reachable) should
be preserved** unless you have a strong reason.

---

## 6. Screen inventory

Every route the designer needs to cover. `:key` = project key (e.g. `TASK`).

| Route | Screen | Purpose & key UI |
|-------|--------|------------------|
| `/login`, `/register` | **Auth** | Email/password. Currently minimal. Rebrand's first impression — needs identity. |
| `/` | **Projects** | Grid/list of projects; entry to create a project. |
| `/teams`, `/teams/:id` | **Teams / Team** | Team list + team detail (members). |
| `/projects/:key/overview` | **Overview** | Project dashboard — summary stats/widgets. |
| `/projects/:key/board` | **Board** ⭐ | **Flagship.** Drag-and-drop Kanban: columns per status, issue cards, **WIP limits, swimlanes, quick filters**. Live-updating. Highest design priority. |
| `/projects/:key/list` | **List** | Dense table view of issues (sort/filter). |
| `/projects/:key/timeline` | **Timeline** | Gantt-style timeline of issues/epics. |
| `/projects/:key/backlog` | **Backlog** | Sprint planning: backlog + sprint sections, start/complete sprint. |
| `/projects/:key/report` | **Sprint report** | Burndown / points for a sprint. |
| `/projects/:key/reports` | **Reports** | Broader charts/reports. |
| `/projects/:key/settings` | **Settings** | Project config: statuses/workflow, labels, members/roles, boards, WIP, swimlanes. Form-heavy. |
| `/issues/:issueKey` | **Issue page** | Full issue view: description, comments, activity log, fields sidebar. |
| `/search` | **Search** | Global search results. |

**Cross-cutting surfaces (must also be styled):**
- **Issue card** (board) — title, labels, team chip, type icon, key, priority
  icon, story points, assignee avatar. Dense, scannable.
- **Issue drawer** (`IssueDrawer`) — slide-over quick view of an issue.
- **Create Issue modal**, **Create Board modal**.
- **Command palette** (⌘K) — search + navigate.
- **Notifications bell** — inbox dropdown (assigned / mentioned / commented /
  status-changed).

⭐ **Priority order for mockups:** Board → Issue page → Backlog → Overview/Reports
→ shell/nav → auth → settings.

---

## 7. Component inventory to restyle

Reusable primitives in `apps/web/src/components/ui/` — redesign each with
**light + dark + all states** (default / hover / focus-visible / active /
disabled / loading where relevant):

`Button` · `Badge` (+`LabelBadge`) · `Chip` · `Avatar` · `Select` ·
`AssigneeSelect` · `LabelPicker` · `Modal` · `PageHeader` · `Spinner` ·
`TeamChip` · issue-type & priority `icons`.

Composite components: `AppLayout` (shell) · `CommandPalette` · `CreateIssueModal`
· `CreateBoardModal` · `IssueCard` · `IssueDrawer` · `NotificationsBell`.

---

## 8. Interaction patterns to preserve

- **⌘K command palette** — keep it central; make it feel first-class.
- **Drag-and-drop board** — clear drag affordance, drop targets, dragging state
  (currently `ring-2 ring-brand-400 shadow-lg`).
- **Live/optimistic updates** — cards/lists change under the user; design should
  make updates feel smooth, not jarring (subtle transitions, skeletons).
- **Keyboard-friendliness** — visible focus states, `kbd` hints.
- **Theme toggle** — light/dark/system cycle stays.

---

## 9. Revamp goals (what "better" means)

1. **Distinct identity** — replace generic indigo-on-gray with a considered,
   Jira-familiar brand: new primary + accent, a **"Task Ache" wordmark/logo**
   (two-word name — design it deliberately), and a real auth first-impression.
2. **Clearer hierarchy** — stronger typographic scale, more intentional spacing,
   better separation of chrome vs content. Currently very flat and uniformly dense.
3. **Issue-type & status semantics** — Jira users rely on color/shape to parse
   type (Epic/Story/Task/Bug/Subtask) and priority at a glance. Make these a
   deliberate, consistent system.
4. **Richer states** — designed empty states, loading skeletons, error states.
   These are thin today.
5. **Board polish** — the board is the product's face; columns, WIP-limit
   indicators, swimlane headers, and cards deserve the most attention.
6. **Depth & focus** — modals, drawers, popovers, and the command palette should
   feel layered and modern (not just `shadow-xl`).

---

## 10. Deliverables requested

1. **Token spec** — new Tailwind color scales (brand primary + accent, neutrals,
   semantic success/warning/danger/info), each with **light + dark** values;
   type scale; radius; elevation/shadow; spacing rhythm. Delivered as a
   `tailwind.config` `extend` block + `index.css` `@layer` tokens.
2. **Component specs** — for each primitive in §7: every variant/size/state, in
   light + dark, expressed as Tailwind classes.
3. **Key-screen mockups** — at minimum Board, Issue page, Backlog, Overview,
   app shell/nav, and auth — in **both themes**.
4. **Issue-type & priority icon/color system.**
5. **State coverage** — empty / loading / error patterns.
6. **Motion notes** — transitions for drag, live updates, modal/drawer enter-exit.

---

## 11. Constraints & non-goals

- **Preserve IA & routes** (§6) unless a change is clearly better — this is a
  visual rebrand, not a product re-architecture.
- **Preserve data model & API contract** — no new fields/entities implied by the
  design without flagging them.
- **Dark mode parity** — no screen ships light-only.
- **Stay in the stack** — Tailwind, lucide, dnd-kit, react-router. No new heavy
  UI dependency (component libraries, CSS-in-JS) without explicit justification.
- **Accessibility: WCAG 2.1 AA** — contrast ≥ 4.5:1 body text, visible focus,
  ≥ 44px touch targets on interactive controls, don't encode meaning in color
  alone (pair with icon/label).
- **Self-hostable, open-source** product — no proprietary/paid fonts or assets
  unless they're license-clean for redistribution.

---

## 12. Where things live (for implementation handoff)

```
apps/web/
├── tailwind.config.js         # color scales, theme.extend  ← tokens
├── src/index.css              # @layer base/components/utilities  ← surface tokens
├── src/components/ui/         # primitives to restyle
├── src/components/            # composite components (shell, modals, drawer, palette)
├── src/pages/                 # one file per screen in §6
└── src/store/theme.ts         # light/dark/system logic (keep)
```

Brand color and neutrals flow from `tailwind.config.js` → surface tokens in
`index.css` → components. Change tokens there and most of the app follows.
