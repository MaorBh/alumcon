import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import logo from "@/assets/logo.png";
import { getCurrentUser, login, SCAN_USERS } from "@/scan/scanAuth";
import { toast } from "sonner";

export default function ScanLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const u = getCurrentUser();
    if (u) navigate(u.role === "qc" ? "/scan/qc" : "/scan/station", { replace: true });
  }, [navigate]);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    const u = login(username, password);
    if (!u) {
      toast.error("שם משתמש או סיסמה שגויים");
      return;
    }
    toast.success(`ברוך הבא, ${u.displayName}`);
    navigate(u.role === "qc" ? "/scan/qc" : "/scan/station", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <img src={logo} alt="Alumkon" className="h-16 w-auto mx-auto" />
          <div>
            <h1 className="text-xl font-bold">סורק אלומקון</h1>
            <p className="text-xs text-muted-foreground">התחברות לתחנת ייצור / בקר איכות</p>
          </div>
        </div>

        <form onSubmit={handle} className="surface-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">שם משתמש</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full h-12 bg-background border border-border rounded-lg px-3 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              placeholder="לדוגמה: cnc, qc1"
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

        <details className="surface-card p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">משתמשים לדוגמה (סיסמה: 1234)</summary>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono">
            {SCAN_USERS.map((u) => (
              <div key={u.username}>
                <span className="text-primary">{u.username}</span> - {u.displayName}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
