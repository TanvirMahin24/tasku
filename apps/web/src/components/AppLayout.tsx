import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Home,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Shield,
  Sparkles,
  Star,
  Sun,
  Table2,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import type { ProjectDto } from '@tasku/types';
import { projectsApi, viewsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useAuthStore, useIsSuperAdmin } from '@/store/auth';
import { useFeature } from '@/hooks/useFeatures';
import { useThemeStore } from '@/store/theme';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationsBell } from '@/components/NotificationsBell';
import { CommandPalette } from '@/components/CommandPalette';
import { CreateIssueModal } from '@/components/CreateIssueModal';
import { MajhiWidget } from '@/components/Majhi/MajhiWidget';

// Deterministic per-space accent from the reference design palette.
const SPACE_COLORS = [
  '#0C66E4',
  '#8270DB',
  '#00857A',
  '#E9730C',
  '#6554C0',
  '#1D9BAD',
  '#E2483D',
  '#22A06B',
];
export function spaceColor(key: string): string {
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  return SPACE_COLORS[sum % SPACE_COLORS.length];
}

// ponytail: starred spaces live in localStorage — no backend for a per-browser
// preference. Swap for an API-backed field if it needs to sync across devices.
const STAR_KEY = 'tori:starredSpaces';
function useStarredSpaces() {
  const [starred, setStarred] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(STAR_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const toggle = (key: string) =>
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(STAR_KEY, JSON.stringify([...next]));
      return next;
    });
  return { starred, toggle };
}

export function AppLayout() {
  const { key } = useParams<{ key: string }>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isSuperAdmin = useIsSuperAdmin();
  const showDashboard = useFeature('dashboard');
  const showTeams = useFeature('teams');
  const showViews = useFeature('views');
  const showKnowledge = useFeature('knowledge');
  const showAssistant = useFeature('assistant');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { starred, toggle } = useStarredSpaces();

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
  });

  const activeProject = projects.find((p) => p.key === key) ?? null;
  const starredProjects = projects.filter((p) => starred.has(p.key));

  const { data: starredViews = [] } = useQuery({
    queryKey: qk.views(true),
    queryFn: () => viewsApi.list(true),
  });

  // Global ⌘K / Ctrl-K to toggle the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-page dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-white text-ink-soft dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
        {/* Logo + create */}
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90">
            <img src="/logo.svg" alt="Tori" className="h-[26px] w-[26px]" />
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink dark:text-white">
              Tori
            </span>
          </Link>
          <button
            onClick={() =>
              activeProject ? setCreateOpen(true) : setPaletteOpen(true)
            }
            title="Create issue"
            className="ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-brand-600 text-white shadow-[0_2px_6px_rgba(232,51,48,.4)] hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>

        {/* Search */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-[12.5px] text-ink-faint hover:bg-surface-sunken dark:border-white/10 dark:hover:bg-white/10"
        >
          <Search className="h-[13px] w-[13px]" />
          <span>Search</span>
          <kbd className="ml-auto rounded border border-line px-1 py-px font-mono text-[10px] font-semibold text-ink-faint dark:border-white/15">
            ⌘K
          </kbd>
        </button>

        <nav className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
          {/* Top-level nav */}
          <div className="flex flex-col gap-px">
            {showDashboard && (
              <SidebarLink to="/dashboard" icon={Home}>
                Your work
              </SidebarLink>
            )}
            <SidebarLink to="/" icon={LayoutGrid} end>
              Spaces
            </SidebarLink>
            {showTeams && (
              <SidebarLink to="/teams" icon={Users}>
                Teams
              </SidebarLink>
            )}
            {showViews && (
              <SidebarLink to="/views" icon={Table2} end>
                Views
              </SidebarLink>
            )}
            {showKnowledge && (
              <SidebarLink to="/knowledge" icon={BookOpen}>
                Knowledge base
              </SidebarLink>
            )}
            {showAssistant && (
              <SidebarLink to="/settings/assistant" icon={Sparkles}>
                Assistant
              </SidebarLink>
            )}
            {isSuperAdmin && (
              <SidebarLink to="/admin" icon={Shield}>
                Admin
              </SidebarLink>
            )}
            {starredViews.map((v) => (
              <NavLink
                key={v.id}
                to={`/views/${v.id}`}
                className={({ isActive }) =>
                  clsx(
                    'ml-6 flex items-center gap-2 rounded-md py-[6px] pl-2.5 pr-2 text-[12.5px] transition-colors',
                    isActive
                      ? 'bg-brand-50 font-semibold text-brand-600 dark:bg-brand-600/25 dark:text-brand-200'
                      : 'font-medium text-ink-soft hover:bg-surface-sunken dark:text-gray-300 dark:hover:bg-white/10',
                  )
                }
              >
                <Star className="h-3 w-3 shrink-0" fill="#FCA700" stroke="#FCA700" />
                <span className="truncate">{v.title}</span>
              </NavLink>
            ))}
          </div>

          {/* Starred */}
          {starredProjects.length > 0 && (
            <>
              <SectionHeader icon={Star} iconFilled>
                Starred
              </SectionHeader>
              <div className="flex flex-col gap-px">
                {starredProjects.map((p) => (
                  <SpaceRow
                    key={p.key}
                    project={p}
                    active={p.key === key}
                    starred
                    onToggleStar={() => toggle(p.key)}
                  />
                ))}
              </div>
            </>
          )}

          {/* All spaces */}
          <SectionHeader icon={LayoutGrid}>All spaces</SectionHeader>
          <div className="flex flex-col gap-px">
            {projects.length === 0 ? (
              <p className="px-2.5 py-1.5 text-[12.5px] text-ink-faint">
                No spaces yet
              </p>
            ) : (
              projects.map((p) => (
                <SpaceRow
                  key={p.key}
                  project={p}
                  active={p.key === key}
                  starred={starred.has(p.key)}
                  onToggleStar={() => toggle(p.key)}
                />
              ))
            )}
          </div>
        </nav>

        {/* Footer: notifications + theme + user */}
        <div className="mt-auto border-t border-line p-2.5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <ThemeToggle />
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1">
              <Avatar user={user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink dark:text-white">
                  {user?.displayName ?? '—'}
                </p>
                <p className="truncate text-xs text-ink-faint dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-surface-sunken hover:text-ink dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projectKey={key}
        onCreateIssue={activeProject ? () => setCreateOpen(true) : undefined}
      />
      {activeProject && (
        <CreateIssueModal
          projectKey={activeProject.key}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {/* Majhi — self-gates on AI availability, so it's safe to always mount. */}
      <MajhiWidget />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  iconFilled,
  children,
}: {
  icon: typeof Star;
  iconFilled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-2 mb-1 mt-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
      <Icon
        className="h-[11px] w-[11px]"
        {...(iconFilled ? { fill: '#FCA700', stroke: '#FCA700' } : {})}
      />
      {children}
    </div>
  );
}

/** A space (project) row: colored dot + name link + star toggle. */
function SpaceRow({
  project,
  active,
  starred,
  onToggleStar,
}: {
  project: ProjectDto;
  active: boolean;
  starred: boolean;
  onToggleStar: () => void;
}) {
  return (
    <div
      className={clsx(
        'group flex items-center gap-2.5 rounded-md pl-2.5 pr-1.5 transition-colors',
        active
          ? 'bg-brand-50 dark:bg-brand-600/25'
          : 'hover:bg-surface-sunken dark:hover:bg-white/10',
      )}
    >
      <NavLink
        to={`/projects/${project.key}`}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-2.5 py-[7px] text-[12.5px]',
          active
            ? 'font-semibold text-brand-600 dark:text-brand-200'
            : 'font-medium text-ink-soft dark:text-gray-300',
        )}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-[3px]"
          style={{ backgroundColor: spaceColor(project.key) }}
        />
        <span className="truncate">{project.name}</span>
      </NavLink>
      <button
        onClick={onToggleStar}
        title={starred ? 'Unstar' : 'Star'}
        className={clsx(
          'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded',
          starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          'hover:bg-black/5 dark:hover:bg-white/10',
        )}
      >
        <Star
          className="h-[15px] w-[15px]"
          {...(starred
            ? { fill: '#FCA700', stroke: '#FCA700' }
            : { stroke: '#B3BAC5' })}
        />
      </button>
    </div>
  );
}

function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const cycle = useThemeStore((s) => s.cycle);
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  const label =
    mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';
  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} (click to change)`}
      aria-label={`Theme: ${label}`}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  children,
  end,
  iconColor,
}: {
  to: string;
  icon: typeof Home;
  children: ReactNode;
  end?: boolean;
  /** When set, render the icon in a small colored rounded-square (space items). */
  iconColor?: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors',
          isActive
            ? 'bg-brand-50 font-semibold text-brand-600 dark:bg-brand-600/25 dark:text-brand-200'
            : 'font-medium text-ink-soft hover:bg-surface-sunken dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
        )
      }
    >
      {iconColor ? (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px]"
          style={{ backgroundColor: iconColor }}
        >
          <Icon className="h-2.5 w-2.5 text-white" />
        </span>
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {children}
    </NavLink>
  );
}
