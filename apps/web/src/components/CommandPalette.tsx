import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock,
  Columns3,
  CornerDownLeft,
  GanttChartSquare,
  Home,
  LayoutGrid,
  ListTodo,
  Moon,
  Monitor,
  Package,
  Plus,
  Rows3,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Table2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  KnowledgeListItemDto,
  ProjectDto,
  TeamDto,
  ViewSummaryDto,
} from '@tasku/types';
import {
  searchApi,
  projectsApi,
  teamsApi,
  viewsApi,
  knowledgeApi,
} from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useDebounced } from '@/hooks/useDebounced';
import { useThemeStore } from '@/store/theme';
import { IssueTypeIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';

// A single navigable palette entry.
interface Item {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  keywords?: string;
  leading: ReactNode;
  run: () => void;
}

const RECENT_KEY = 'tori:recent-issues';

type RecentIssue = { key: string; title: string; type: string };

function readRecent(): RecentIssue[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}
function pushRecent(r: RecentIssue) {
  const list = readRecent().filter((x) => x.key !== r.key);
  list.unshift(r);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
}

function matches(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((tok) => hay.includes(tok));
}

function IconBox({ icon: Icon, color }: { icon: LucideIcon; color?: string }) {
  return (
    <span className="flex h-6 w-6 flex-none items-center justify-center text-ink-faint">
      <Icon className="h-4 w-4" style={color ? { color } : undefined} />
    </span>
  );
}

export function CommandPalette({
  open,
  onClose,
  projectKey,
  onCreateIssue,
}: {
  open: boolean;
  onClose: () => void;
  projectKey?: string;
  onCreateIssue?: () => void;
}) {
  const navigate = useNavigate();
  const setMode = useThemeStore((s) => s.setMode);
  const [text, setText] = useState('');
  const debounced = useDebounced(text, 200);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setActive(0);
    }
  }, [open]);

  const q = debounced.trim();
  const ql = q.toLowerCase();

  // --- data sources (cached; only when open) ---
  const { data: search, isFetching } = useQuery({
    queryKey: qk.search({ text: q }),
    queryFn: () => searchApi.issues({ text: q }),
    enabled: open && q.length >= 1,
  });
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
    enabled: open,
  });
  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
    enabled: open,
  });
  const { data: views = [] } = useQuery({
    queryKey: qk.views(),
    queryFn: () => viewsApi.list(),
    enabled: open,
  });
  const { data: docs = [] } = useQuery({
    queryKey: qk.knowledgeAll('__palette__'),
    queryFn: () => knowledgeApi.listAll(),
    enabled: open,
  });

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  // --- command items (navigation, actions, theme) ---
  const commands = useMemo<Item[]>(() => {
    const items: Item[] = [];
    if (projectKey && onCreateIssue) {
      items.push({
        id: 'cmd-create',
        group: 'Actions',
        label: 'Create issue',
        keywords: 'new task bug story add',
        leading: <IconBox icon={Plus} color="#0C66E4" />,
        run: () => {
          onClose();
          onCreateIssue();
        },
      });
    }
    items.push({
      id: 'cmd-majhi',
      group: 'Actions',
      label: 'Ask Majhi',
      sublabel: 'AI assistant',
      keywords: 'ai assistant chat help',
      leading: <IconBox icon={Sparkles} color="#0C66E4" />,
      run: () => {
        onClose();
        window.dispatchEvent(new CustomEvent('majhi:open'));
      },
    });

    const nav: [string, LucideIcon, string][] = [
      ['/dashboard', Home, 'Your work'],
      ['/', LayoutGrid, 'Spaces'],
      ['/teams', Users, 'Teams'],
      ['/views', Table2, 'Views'],
      ['/knowledge', BookOpen, 'Knowledge base'],
      ['/search', SearchIcon, 'Advanced search'],
      ['/settings/assistant', Sparkles, 'Assistant settings'],
    ];
    for (const [to, icon, label] of nav) {
      items.push({
        id: `nav-${to}`,
        group: 'Go to',
        label,
        keywords: 'navigate open',
        leading: <IconBox icon={icon} />,
        run: () => go(to),
      });
    }

    if (projectKey) {
      const pnav: [string, LucideIcon, string][] = [
        ['overview', BarChart3, 'Overview'],
        ['board', Columns3, 'Board'],
        ['list', Rows3, 'List'],
        ['backlog', ListTodo, 'Backlog'],
        ['timeline', GanttChartSquare, 'Timeline'],
        ['calendar', CalendarDays, 'Calendar'],
        ['reports', BarChart3, 'Reports'],
        ['releases', Package, 'Releases'],
        ['settings', SettingsIcon, 'Settings'],
      ];
      for (const [seg, icon, label] of pnav) {
        items.push({
          id: `pnav-${seg}`,
          group: `Space · ${projectKey}`,
          label,
          keywords: `${projectKey} project space`,
          leading: <IconBox icon={icon} />,
          run: () => go(`/projects/${projectKey}/${seg}`),
        });
      }
    }

    const themes: [string, LucideIcon, 'light' | 'dark' | 'system'][] = [
      ['Light', Sun, 'light'],
      ['Dark', Moon, 'dark'],
      ['System', Monitor, 'system'],
    ];
    for (const [label, icon, mode] of themes) {
      items.push({
        id: `theme-${mode}`,
        group: 'Theme',
        label: `Switch to ${label} theme`,
        keywords: 'theme appearance dark light mode color',
        leading: <IconBox icon={icon} />,
        run: () => {
          setMode(mode);
          onClose();
        },
      });
    }
    return items.filter((c) => matches(ql, c.label, c.sublabel, c.keywords));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, onCreateIssue, ql]);

  // --- entity items ---
  const issueItems = useMemo<Item[]>(
    () =>
      (search?.issues ?? []).map((i) => ({
        id: `issue-${i.id}`,
        group: 'Issues',
        label: i.title,
        sublabel: i.key,
        leading: <IssueTypeIcon type={i.type} />,
        run: () => {
          pushRecent({ key: i.key, title: i.title, type: i.type });
          go(`/issues/${i.key}`);
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search],
  );

  const recentItems = useMemo<Item[]>(() => {
    if (q) return [];
    return readRecent().map((r) => ({
      id: `recent-${r.key}`,
      group: 'Recent',
      label: r.title,
      sublabel: r.key,
      leading: <Clock className="h-4 w-4 text-ink-faint" />,
      run: () => go(`/issues/${r.key}`),
    }));
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const spaceItems = useMemo<Item[]>(
    () =>
      (projects as ProjectDto[])
        .filter((p) => matches(ql, p.name, p.key))
        .slice(0, 6)
        .map((p) => ({
          id: `space-${p.id}`,
          group: 'Spaces',
          label: p.name,
          sublabel: p.key,
          leading: <IconBox icon={LayoutGrid} />,
          run: () => go(`/projects/${p.key}`),
        })),
    [projects, ql],
  );

  const viewItems = useMemo<Item[]>(
    () =>
      (views as ViewSummaryDto[])
        .filter((v) => matches(ql, v.title))
        .slice(0, 5)
        .map((v) => ({
          id: `view-${v.id}`,
          group: 'Views',
          label: v.title,
          leading: <IconBox icon={Table2} />,
          run: () => go(`/views/${v.id}`),
        })),
    [views, ql],
  );

  const teamItems = useMemo<Item[]>(
    () =>
      (teams as TeamDto[])
        .filter((t) => matches(ql, t.name))
        .slice(0, 5)
        .map((t) => ({
          id: `team-${t.id}`,
          group: 'Teams',
          label: t.name,
          leading: (
            <span
              className="ml-1 h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: t.color }}
            />
          ),
          run: () => go(`/teams/${t.id}`),
        })),
    [teams, ql],
  );

  const docItems = useMemo<Item[]>(() => {
    if (!q) return [];
    return (docs as KnowledgeListItemDto[])
      .filter((d) => matches(ql, d.title, d.owner.label))
      .slice(0, 5)
      .map((d) => ({
        id: `doc-${d.id}`,
        group: 'Knowledge',
        label: d.title,
        sublabel: d.owner.label,
        leading: <IconBox icon={BookOpen} />,
        run: () => {
          if (d.type === 'LINK' && d.url)
            window.open(d.url, '_blank', 'noopener');
          else go('/knowledge');
        },
      }));
  }, [docs, q, ql]);

  // --- ordered sections + flat list for keyboard nav ---
  const sections = useMemo(() => {
    const out: { label: string; items: Item[] }[] = [];
    if (recentItems.length) out.push({ label: 'Recent', items: recentItems });
    if (issueItems.length) out.push({ label: 'Issues', items: issueItems });
    if (spaceItems.length) out.push({ label: 'Spaces', items: spaceItems });
    if (viewItems.length) out.push({ label: 'Views', items: viewItems });
    if (teamItems.length) out.push({ label: 'Teams', items: teamItems });
    if (docItems.length) out.push({ label: 'Knowledge', items: docItems });
    // group commands by their own group label, preserving order
    const cmdGroups = new Map<string, Item[]>();
    for (const c of commands) {
      if (!cmdGroups.has(c.group)) cmdGroups.set(c.group, []);
      cmdGroups.get(c.group)!.push(c);
    }
    for (const [label, items] of cmdGroups) out.push({ label, items });
    return out;
  }, [
    recentItems,
    issueItems,
    spaceItems,
    viewItems,
    teamItems,
    docItems,
    commands,
  ]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flat[active]?.run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, flat, active, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  let idx = -1;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-black/70"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 mt-[9vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-white shadow-raise dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4 dark:border-gray-800">
          <SearchIcon className="h-5 w-5 flex-none text-ink-faint" />
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search issues, spaces, views, docs — or run a command…"
            className="w-full bg-transparent py-4 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none dark:text-gray-100"
          />
          {isFetching && <Spinner className="h-4 w-4" />}
          <kbd className="hidden flex-none rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-sans text-[10px] text-ink-muted sm:block dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[62vh] overflow-y-auto scrollbar-thin py-2"
        >
          {sections.map((section) => (
            <div key={section.label} className="mb-1">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {section.label}
              </p>
              {section.items.map((item) => {
                idx += 1;
                const i = idx;
                return (
                  <button
                    key={item.id}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => item.run()}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                      active === i
                        ? 'bg-brand-50 text-ink dark:bg-brand-500/15 dark:text-gray-100'
                        : 'text-ink-soft hover:bg-surface-sunken dark:text-gray-300 dark:hover:bg-gray-800/60',
                    )}
                  >
                    {item.leading}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="flex-none font-mono text-[11px] text-ink-faint">
                        {item.sublabel}
                      </span>
                    )}
                    {active === i && (
                      <CornerDownLeft className="h-3.5 w-3.5 flex-none text-brand-600" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {flat.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-faint">
              {q ? `No results for “${q}”.` : 'Start typing to search.'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line-soft px-4 py-2 text-[11px] text-ink-faint dark:border-gray-800">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>navigate</span>
          <Kbd>↵</Kbd>
          <span>select</span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>⌘K</Kbd>
            <span>command</span>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-sans text-[10px] text-ink-muted dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {children}
    </kbd>
  );
}
