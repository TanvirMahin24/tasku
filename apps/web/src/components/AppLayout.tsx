import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronsUpDown,
  Columns3,
  GanttChartSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  Rows3,
  Users,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import { projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationsBell } from '@/components/NotificationsBell';

export function AppLayout() {
  const { key } = useParams<{ key: string }>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
  });

  const activeProject = projects.find((p) => p.key === key) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-gray-900 text-gray-100">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-4 text-white hover:opacity-90"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Tasku</span>
        </Link>

        <div className="px-3">
          <ProjectSwitcher
            projects={projects}
            activeKey={key}
            onSelect={(k) => navigate(`/projects/${k}/board`)}
          />
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 scrollbar-thin">
          <SidebarLink to="/" icon={ListTodo} end>
            Projects
          </SidebarLink>
          <SidebarLink to="/teams" icon={Users}>
            Teams
          </SidebarLink>

          {activeProject && (
            <>
              <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {activeProject.name}
              </p>
              <SidebarLink
                to={`/projects/${activeProject.key}/overview`}
                icon={LayoutDashboard}
              >
                Overview
              </SidebarLink>
              <SidebarLink to={`/projects/${activeProject.key}/board`} icon={Columns3}>
                Board
              </SidebarLink>
              <SidebarLink to={`/projects/${activeProject.key}/list`} icon={Rows3}>
                List
              </SidebarLink>
              <SidebarLink
                to={`/projects/${activeProject.key}/timeline`}
                icon={GanttChartSquare}
              >
                Timeline
              </SidebarLink>
              <SidebarLink
                to={`/projects/${activeProject.key}/backlog`}
                icon={ListTodo}
              >
                Backlog
              </SidebarLink>
              <SidebarLink
                to={`/projects/${activeProject.key}/report`}
                icon={BarChart3}
              >
                Sprint report
              </SidebarLink>
            </>
          )}
        </nav>

        {/* Footer: notifications + user */}
        <div className="mt-auto border-t border-white/10 p-3">
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1">
              <Avatar user={user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.displayName ?? '—'}
                </p>
                <p className="truncate text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-300 hover:bg-white/10 hover:text-white"
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
    </div>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  children,
  end,
}: {
  to: string;
  icon: typeof Columns3;
  children: ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-600/90 text-white'
            : 'text-gray-300 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </NavLink>
  );
}

function ProjectSwitcher({
  projects,
  activeKey,
  onSelect,
}: {
  projects: { key: string; name: string }[];
  activeKey?: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = projects.find((p) => p.key === activeKey);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md bg-white/5 px-2.5 py-2 text-left text-sm hover:bg-white/10"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-600 text-[11px] font-bold text-white">
          {active ? active.key.slice(0, 2) : '—'}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-white">
          {active ? active.name : 'Select project'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {projects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No projects yet</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    onSelect(p.key);
                    setOpen(false);
                  }}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50',
                    p.key === activeKey
                      ? 'font-semibold text-brand-700'
                      : 'text-gray-700',
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-600">
                    {p.key.slice(0, 2)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> New project
          </Link>
        </div>
      )}
    </div>
  );
}
