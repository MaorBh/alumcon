import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { ScanUser, logout } from "./scanAuth";

interface Props {
  user: ScanUser;
  title: string;
  children: ReactNode;
}

export default function ScanLayout({ user, title, children }: Props) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir="rtl">
      <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="" className="h-7 w-auto shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">{title}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.displayName}</div>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/scan/login", { replace: true });
          }}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          aria-label="התנתק"
          title="התנתק"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>
      <main className="flex-1 p-4 pb-8 max-w-xl w-full mx-auto">{children}</main>
    </div>
  );
}
