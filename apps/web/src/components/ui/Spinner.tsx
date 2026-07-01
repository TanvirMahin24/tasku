import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-ink-faint', className)} />;
}

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 py-16 text-ink-faint">
      <Spinner className="h-7 w-7" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
