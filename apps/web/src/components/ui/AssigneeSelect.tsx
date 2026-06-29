import type { UserDto } from '@tasku/types';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Compact assignee selector built on a native <select> (for reliable a11y +
 * keyboard) with an avatar preview alongside.
 */
export function AssigneeSelect({
  users,
  value,
  onChange,
  allowUnassigned = true,
}: {
  users: UserDto[];
  value: string | null;
  onChange: (userId: string | null) => void;
  allowUnassigned?: boolean;
}) {
  const selected = users.find((u) => u.id === value) ?? null;
  return (
    <div className="flex items-center gap-2">
      <Avatar user={selected} size="sm" />
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        className="block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {allowUnassigned && <option value="">Unassigned</option>}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
