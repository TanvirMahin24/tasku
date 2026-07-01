import clsx from 'clsx';
import type { UserDto } from '@tasku/types';
import { avatarColor, initials } from '@/lib/format';

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
} as const;

export interface AvatarProps {
  user?: Pick<UserDto, 'displayName' | 'avatarUrl' | 'email'> | null;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}

export function Avatar({ user, size = 'md', className, title }: AvatarProps) {
  const name = user?.displayName ?? 'Unassigned';
  const tooltip = title ?? name;

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        title={tooltip}
        className={clsx(
          'inline-block rounded-full object-cover ring-2 ring-white dark:ring-gray-900',
          SIZES[size],
          className,
        )}
      />
    );
  }

  if (!user) {
    return (
      <span
        title="Unassigned"
        className={clsx(
          'inline-flex items-center justify-center rounded-full bg-[#EFF1F4] text-[#8590A2] ring-2 ring-white dark:bg-gray-700 dark:text-gray-400 dark:ring-gray-900',
          SIZES[size],
          className,
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3/5 w-3/5">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className={clsx(
        'inline-flex select-none items-center justify-center rounded-full font-bold text-white ring-2 ring-white dark:ring-gray-900',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: avatarColor(user.email || name) }}
    >
      {initials(name)}
    </span>
  );
}
