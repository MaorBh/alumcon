import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/auth/users";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (user) {
    const from = (location.state as { from?: string } | null)?.from || "/";
    navigate(from, { replace: true });
  }

  const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = login(username, password);
    if (!u) {
      toast.error("שם משתמש או סיסמה שגויים");
      return;
    }
    // Silently get a backend JWT for API access (local dev bridge)
    if (u.role === "admin") {
      try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "admin@alumcon.com", password: "Alumcon2024!" }),
        });
        if (res.ok) {
          const { token } = await res.json();
          localStorage.setItem("auth-token", token);
        }
      } catch { /* backend offline — local-only mode */ }
    }
    toast.success(`ברוך הבא, ${u.displayName} (${ROLE_LABELS[u.role]})`);
    const from = (location.state as { from?: string } | null)?.from || "/";
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <img src={logo} alt="Alumkon" className="h-16 w-auto mx-auto" />
          <div>
            <h1 className="text-2xl font-bold">אלומקון</h1>
            <p className="text-sm text-muted-foreground">מערכת ניהול ייצור</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="surface-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">שם משתמש</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full h-12 bg-background border border-border rounded-lg px-3 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              placeholder="admin"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full h-12 bg-background border border-border rounded-lg px-3 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              placeholder="••••"
            />
          </div>
          <button
            type="submit"
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition"
          >
            <LogIn className="w-4 h-4" />
            התחבר
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          ברירת מחדל: <span className="font-mono text-foreground">admin / admin</span>
        </p>
      </div>
    </div>
  );
}
