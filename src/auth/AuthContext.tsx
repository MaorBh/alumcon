import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { AppRole, AppUser, getCurrentUser, login as doLogin, logout as doLogout } from "./users";

interface AuthCtx {
  user: AppUser | null;
  login: (username: string, password: string) => AppUser | null;
  logout: () => void;
  hasRole: (...roles: AppRole[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => getCurrentUser());

  useEffect(() => {
    const refresh = () => setUser(getCurrentUser());
    window.addEventListener("app-auth-changed", refresh);
    window.addEventListener("app-users-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("app-auth-changed", refresh);
      window.removeEventListener("app-users-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const value: AuthCtx = {
    user,
    login: (u, p) => {
      const res = doLogin(u, p);
      if (res) setUser(res);
      return res;
    },
    logout: () => {
      doLogout();
      setUser(null);
    },
    hasRole: (...roles) => !!user && roles.includes(user.role),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
