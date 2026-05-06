import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { AppRole } from "@/auth/users";

export default function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: AppRole[];
}) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
