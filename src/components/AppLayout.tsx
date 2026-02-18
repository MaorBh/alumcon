import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FolderKanban, 
  ScanBarcode, 
  Settings, 
  ChevronRight,
  Factory,
  Menu,
  X
} from "lucide-react";
import logo from "@/assets/logo.png";

const navItems = [
  { path: "/", label: "מבט על", icon: LayoutDashboard },
  { path: "/projects", label: "פרויקטים", icon: FolderKanban },
  { path: "/items", label: "פריטים", icon: ScanBarcode },
  { path: "/stations", label: "תחנות", icon: Factory },
  { path: "/settings", label: "הגדרות", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-60" : "w-16"
        } bg-sidebar border-l border-sidebar-border flex flex-col transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <img src={logo} alt="Aluminum Construction Group" className="h-8 w-auto" />
              <span className="font-bold text-lg text-sidebar-accent-foreground">אלומקון</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          >
            {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary glow-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-sidebar-border">
            <div className="text-xs text-muted-foreground">
              מערכת ניהול ייצור v1.0
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {navItems.find(n => 
                n.path === location.pathname || 
                (n.path !== "/" && location.pathname.startsWith(n.path))
              )?.label || "דשבורד"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-status-completed animate-pulse-glow" />
            <span className="text-sm text-muted-foreground">מערכת פעילה</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
