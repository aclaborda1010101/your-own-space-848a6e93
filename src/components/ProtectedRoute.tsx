import { SessionGuard } from "@/components/SessionGuard";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Backwards-compatible wrapper. Delegates to SessionGuard which adds
 * automatic session recovery on transient auth loss (token refresh failure,
 * network blip, tab refocus) instead of immediately redirecting to /login.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  return <SessionGuard>{children}</SessionGuard>;
};
