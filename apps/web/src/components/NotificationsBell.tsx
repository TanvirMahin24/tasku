import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import type { NotificationDto } from '@tasku/types';
import { notificationsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { relativeTime } from '@/lib/format';
import { subscribeToNotifications } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Spinner';

const TYPE_LABEL: Record<NotificationDto['type'], string> = {
  ASSIGNED: 'Assigned',
  MENTIONED: 'Mentioned',
  COMMENTED: 'Comment',
  STATUS_CHANGED: 'Status',
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: qk.notifications,
    queryFn: notificationsApi.list,
    refetchInterval: 30_000, // fallback poll; live updates arrive over the socket
  });

  // Live: refetch the moment the server pushes a notification to this user.
  useEffect(() => {
    return subscribeToNotifications(token, () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications });
    });
  }, [token, queryClient]);

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-300 hover:bg-white/10 hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-11 z-40 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-700/60">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/issues/${n.issueKey}`}
                      onClick={() => {
                        if (!n.read) markRead.mutate(n.id);
                        setOpen(false);
                      }}
                      className={clsx(
                        'flex gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50',
                        !n.read && 'bg-brand-50/50 dark:bg-brand-500/10',
                      )}
                    >
                      <span
                        className={clsx(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          n.read ? 'bg-transparent' : 'bg-brand-500',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                            {TYPE_LABEL[n.type]}
                          </span>
                          <span className="truncate text-xs font-semibold text-brand-700 dark:text-brand-300">
                            {n.issueKey}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-gray-700 dark:text-gray-200">
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
