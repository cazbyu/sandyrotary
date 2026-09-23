import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rememberReturnTo, takeReturnTo } from '../lib/returnTo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireLeader?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireLeader = false }: ProtectedRouteProps) {
  const { user, member, isAdmin, isLeader, isNonMember, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <Navigate to="/login" state={{ error }} replace />;
  }

  if (!user) {
    // Come back here after login (Google, magic link and password all land on "/" first).
    // Only for a signed-out arrival (the tab's first page), not after signing out.
    if (location.key === 'default') rememberReturnTo(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  if (isNonMember) {
    return <Navigate to="/access-denied" replace />;
  }

  // Wait for the member record, so leader/admin checks on the remembered page can pass.
  const returnTo = member ? takeReturnTo(location.pathname + location.search) : null;
  if (returnTo) {
    return <Navigate to={returnTo} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireLeader && !isLeader) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
