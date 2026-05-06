import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ScanBarcode,
  Settings,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/users";
import { useNavigate } from "react-router-dom";

const navItems = [
  { path: "/", label: "מבט על", icon: LayoutDashboard },
  { path: "/projects", label: "פרויקטים", icon: FolderKanban },
  { path: "/items", label: "פריטים", icon: ScanBarcode },
  { path: "/settings", label: "הגדרות", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLight, setIsLight] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light"),
  );

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  }, [isLight]);

  const activeItem = navItems.find(
    (n) => n.path === location.pathname || (n.path !== "/" && location.pathname.startsWith(n.path)),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-[72px]"
        } bg-sidebar border-l border-sidebar-border flex flex-col transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={logo} alt="Aluminum Construction Group" className="h-8 w-auto shrink-0" />
              <span className="font-bold text-base tracking-tight text-sidebar-accent-foreground truncate">
                אלומקון
              </span>
            </div>
          ) : (
            <img src={logo} alt="" className="h-8 w-auto mx-auto" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors shrink-0"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === location.pathname ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 h-10 px-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-sidebar-primary" />
                )}
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          {sidebarOpen ? (
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              מערכת ניהול ייצור
              <span className="block font-inter text-foreground/60">v1.0.0</span>
            </div>
          ) : (
            <div className="text-center text-[10px] text-muted-foreground font-inter">v1.0</div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {activeItem?.label || "דשבורד"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/60">
              <span className="w-1.5 h-1.5 rounded-full bg-status-completed animate-pulse-glow" />
              <span className="text-xs font-medium text-muted-foreground">מערכת פעילה</span>
            </div>
            <button
              onClick={() => setIsLight((v) => !v)}
              className="w-9 h-9 rounded-lg border border-border/60 bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
              title={isLight ? "מצב כהה" : "מצב בהיר"}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            {user && (
              <div className="flex items-center gap-2 pr-2 border-r border-border/60">
                <div className="text-right leading-tight">
                  <div className="text-xs font-semibold text-foreground">{user.displayName}</div>
                  <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                  className="w-9 h-9 rounded-lg border border-border/60 bg-secondary/60 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center text-muted-foreground transition-colors"
                  aria-label="Logout"
                  title="התנתק"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto px-6 py-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
