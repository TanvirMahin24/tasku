import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { PageSpinner } from '@/components/ui/Spinner';

/**
 * Guards authenticated routes. Redirects to /login when there's no token,
 * and hydrates the current user (GET /auth/me) on first mount.
 */
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const initialized = useAuthStore((s) => s.initialized);
  const hydrate = useAuthStore((s) => s.hydrate);
  const location = useLocation();

  useEffect(() => {
    if (!initialized) {
      void hydrate();
    }
  }, [initialized, hydrate]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageSpinner label="Loading your workspace…" />
      </div>
    );
  }

  return <Outlet />;
}
