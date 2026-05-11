import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Detects mobile / handheld scanner devices and redirects them to the scanner app.
 * The main admin system is desktop-only. On phones / Urovo DT50S the user
 * should land on /scan/login automatically.
 */
function isHandheld(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Urovo devices report "Urovo" or "DT50" in the UA
  if (/Urovo|DT50/i.test(ua)) return true;
  if (/Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  // Coarse pointer + small screen = touch handheld
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (coarse && window.innerWidth < 900) return true;
  return false;
}

export default function MobileGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Allow desktop override via ?desktop=1 (persisted in sessionStorage)
  const params = new URLSearchParams(location.search);
  if (params.get("desktop") === "1") {
    sessionStorage.setItem("force-desktop", "1");
  }
  const forced = sessionStorage.getItem("force-desktop") === "1";

  if (!forced && isHandheld()) {
    return <Navigate to="/scan/login" replace />;
  }
  return <>{children}</>;
}
