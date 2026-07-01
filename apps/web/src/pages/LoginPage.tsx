import {
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Select';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Sign in to Tasku" subtitle="Plan, track, and ship your work.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          required
        />
        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Shared auth UI (also used by RegisterPage)
// ---------------------------------------------------------------------------

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-gray-50 to-brand-50 dark:from-gray-950 dark:to-gray-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </span>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </label>
  );
}
