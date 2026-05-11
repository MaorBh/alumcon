import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Smartphone, ChevronLeft, CheckCircle2, ScanLine } from "lucide-react";
import logo from "@/assets/logo.png";

// Browser BeforeInstallPromptEvent type isn't in lib.dom yet
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function ScanInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (navigator as any).standalone === true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const res = await deferred.userChoice;
    if (res.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center space-y-3 pt-4">
          <img src={logo} alt="Alumkon" className="h-14 w-auto mx-auto" />
          <h1 className="text-xl font-bold">התקנת סורק אלומקון</h1>
          <p className="text-xs text-muted-foreground">למסופונים Urovo DT50S ולכל מכשיר אנדרואיד</p>
        </div>

        {(installed || isStandalone) && (
          <div className="surface-card p-4 flex items-center gap-3 border-emerald-500/40 bg-emerald-500/5">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div className="text-sm">
              <div className="font-bold">האפליקציה מותקנת</div>
              <div className="text-muted-foreground text-xs">אפשר לפתוח אותה מהאייקון במסך הבית.</div>
            </div>
          </div>
        )}

        {deferred && !installed && (
          <button
            onClick={triggerInstall}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg"
          >
            <Download className="w-5 h-5" />
            התקן את האפליקציה
          </button>
        )}

        <section className="surface-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Smartphone className="w-4 h-4 text-primary" />
            התקנה ידנית (Chrome על אנדרואיד)
          </div>
          <ol className="space-y-2 text-sm leading-relaxed list-decimal pr-5 text-muted-foreground">
            <li>פתח דף זה בדפדפן <span className="text-foreground font-semibold">Chrome</span> במסופון.</li>
            <li>גע בתפריט (⋮) בפינה הימנית עליונה.</li>
            <li>בחר <span className="text-foreground font-semibold">"הוסף למסך הבית"</span> או <span className="text-foreground font-semibold">"התקן אפליקציה"</span>.</li>
            <li>אשר את ההתקנה. אייקון "אלומקון" יופיע במסך הבית.</li>
            <li>פתח מהאייקון - האפליקציה תעבוד במסך מלא, ללא סרגל דפדפן.</li>
          </ol>
        </section>

        <section className="surface-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ScanLine className="w-4 h-4 text-primary" />
            סריקת ברקוד
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• <span className="text-foreground">סורק חומרה (Urovo):</span> לחץ על הטריגר הפיזי - הברקוד יוזן אוטומטית.</li>
            <li>• <span className="text-foreground">מצלמה:</span> גע באייקון המצלמה בשדה הברקוד.</li>
            <li>• <span className="text-foreground">הקלדה ידנית:</span> גע פעמיים על השדה כדי להפעיל מקלדת.</li>
          </ul>
        </section>

        <Link
          to="/scan/login"
          className="w-full h-12 rounded-xl border border-border flex items-center justify-center gap-1 text-sm font-semibold hover:bg-secondary transition"
        >
          המשך להתחברות
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
