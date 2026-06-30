import type { ReactNode } from 'react';
import clsx from 'clsx';

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={clsx(
        'flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3.5 dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && (
          <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white/50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900/40">
      {icon && <div className="mb-3 text-gray-300 dark:text-gray-600">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
