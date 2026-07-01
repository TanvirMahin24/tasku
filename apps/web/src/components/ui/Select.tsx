import { forwardRef, type SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={clsx(
          'block w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink',
          'focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint',
          'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-800/50',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  },
);
Select.displayName = 'Select';

// Shared input/textarea styling so forms look consistent.
export const inputClass =
  'block w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500';
