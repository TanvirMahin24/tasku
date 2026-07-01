import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { spaceColor } from '@/components/AppLayout';

// Per-space top navigation — mirrors the reference design: breadcrumb,
// space icon + name, then an underline tab strip. Wraps every /projects/:key
// route so the chrome is defined once.
const TABS: { to: string; label: string }[] = [
  { to: 'overview', label: 'Overview' },
  { to: 'board', label: 'Board' },
  { to: 'backlog', label: 'Backlog' },
  { to: 'list', label: 'List' },
  { to: 'timeline', label: 'Timeline' },
  { to: 'report', label: 'Sprint report' },
  { to: 'reports', label: 'Reports' },
  { to: 'releases', label: 'Releases' },
  { to: 'settings', label: 'Settings' },
];

export function SpaceLayout() {
  const { key = '' } = useParams<{ key: string }>();

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
  });
  const project = projects.find((p) => p.key === key) ?? null;
  const name = project?.name ?? key;
  const color = spaceColor(key);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-page dark:bg-gray-950">
      <div className="flex-none border-b border-line bg-white px-6 pt-3.5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-faint">
          <Link to="/" className="hover:text-ink-soft">
            Spaces
          </Link>
          <span>/</span>
          <span className="text-ink-soft dark:text-gray-300">{name}</span>
        </div>

        <div className="mt-[7px] flex items-center gap-2.5">
          <span
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[12px] font-extrabold text-white"
            style={{ backgroundColor: color }}
          >
            {key.slice(0, 1).toUpperCase()}
          </span>
          <h1 className="truncate text-[20px] font-bold tracking-[-0.02em] text-ink dark:text-white">
            {name}
          </h1>
        </div>

        <nav className="mt-3 flex gap-[22px] overflow-x-auto scrollbar-thin">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={`/projects/${key}/${t.to}`}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[13px] transition-colors',
                  isActive
                    ? 'border-brand-600 font-semibold text-brand-600'
                    : 'border-transparent font-medium text-ink-muted hover:text-ink-soft dark:text-gray-400',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
