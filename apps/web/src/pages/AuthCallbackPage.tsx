import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Spinner';
import { AuthShell } from '@/pages/LoginPage';

/**
 * Landing page for the Google OAuth redirect. The API hands us the JWT in the
 * URL fragment (`#token=…`) so it never hits the server or logs. We adopt it,
 * hydrate the user, then bounce to the app.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const loginWithToken = useAuthStore((s) => s.loginWithToken);
  const [error, setError] = useState<string | null>(null);
  // React 18 StrictMode double-invokes effects in dev; guard the exchange.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    // Scrub the token from the address bar immediately.
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      setError('No sign-in token was returned. Please try again.');
      return;
    }

    loginWithToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('Could not complete Google sign-in. Please try again.'));
  }, [loginWithToken, navigate]);

  if (error) {
    return (
      <AuthShell title="Sign-in failed" subtitle="Something went wrong.">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
        <Link
          to="/login"
          className="mt-4 block text-center text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Signing you in…" subtitle="Finishing Google sign-in.">
      <div className="flex items-center justify-center py-6 text-ink-muted dark:text-gray-400">
        <Spinner className="h-6 w-6" />
      </div>
    </AuthShell>
  );
}
