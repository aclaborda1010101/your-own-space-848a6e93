import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // TEMPORAL: Deshabilitar autenticación para auditoría
  // TODO: Reactivar autenticación cuando termine la auditoría
  return <>{children}</>;
};
