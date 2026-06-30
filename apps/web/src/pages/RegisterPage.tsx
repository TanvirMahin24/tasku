import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { AuthShell, Field } from './LoginPage';

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await register({ displayName, email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create account'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Get started with Tasku in seconds."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Display name"
          autoComplete="name"
          value={displayName}
          onChange={setDisplayName}
          placeholder="Ada Lovelace"
          required
        />
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
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          required
        />
        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
