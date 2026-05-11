import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Plus, Trash2, FileBarChart2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface ReportSettings {
  enabled: boolean;
  recipients: string[];
  frequency: "daily" | "weekly" | "monthly";
  sendTime: string; // HH:MM
  weekday: number; // 0-6 (for weekly)
  monthDay: number; // 1-28 (for monthly)
  includeProjectBreakdown: boolean;
  includeStationBreakdown: boolean;
  includeRejects: boolean;
  includeAvgTime: boolean;
}

const STORAGE_KEY = "alumkon.reportSettings";

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  enabled: false,
  recipients: [],
  frequency: "daily",
  sendTime: "08:00",
  weekday: 0,
  monthDay: 1,
  includeProjectBreakdown: true,
  includeStationBreakdown: true,
  includeRejects: true,
  includeAvgTime: true,
};

export function loadReportSettings(): ReportSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REPORT_SETTINGS;
    return { ...DEFAULT_REPORT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REPORT_SETTINGS;
  }
}

export function saveReportSettings(s: ReportSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function ReportSettingsCard() {
  const [settings, setSettings] = useState<ReportSettings>(() => loadReportSettings());
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    saveReportSettings(settings);
  }, [settings]);

  const update = <K extends keyof ReportSettings>(key: K, value: ReportSettings[K]) =>
    setSettings(s => ({ ...s, [key]: value }));

  const addRecipient = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "כתובת לא תקינה", description: "הזן כתובת מייל חוקית", variant: "destructive" });
      return;
    }
    if (settings.recipients.includes(email)) {
      toast({ title: "הנמען כבר קיים" });
      return;
    }
    update("recipients", [...settings.recipients, email]);
    setNewEmail("");
  };

  const removeRecipient = (email: string) =>
    update("recipients", settings.recipients.filter(e => e !== email));

  const inputClass =
    "h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition";

  const frequencyLabel: Record<ReportSettings["frequency"], string> = {
    daily: "יומי",
    weekly: "שבועי",
    monthly: "חודשי",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileBarChart2 className="w-5 h-5" />
          ניהול דוחות ושליחה אוטומטית
        </CardTitle>
        <CardDescription>
          הגדר נמענים, תדירות ותכולה של דוח הייצור הנשלח אוטומטית במייל
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
          <div>
            <div className="font-medium text-sm">שליחה אוטומטית פעילה</div>
            <div className="text-xs text-muted-foreground">
              {settings.enabled
                ? `הדוח יישלח ${frequencyLabel[settings.frequency]} בשעה ${settings.sendTime} ל־${settings.recipients.length} נמענים`
                : "השליחה האוטומטית מושבתת"}
            </div>
          </div>
          <button
            onClick={() => update("enabled", !settings.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? "bg-primary" : "bg-secondary"
            }`}
            aria-label="הפעל שליחה אוטומטית"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                settings.enabled ? "-translate-x-6" : "-translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Schedule */}
        <div className="space-y-3">
          <div className="text-sm font-semibold">תדירות שליחה</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">תדירות</label>
              <select
                value={settings.frequency}
                onChange={e => update("frequency", e.target.value as ReportSettings["frequency"])}
                className={`${inputClass} w-full`}
              >
                <option value="daily">יומי</option>
                <option value="weekly">שבועי</option>
                <option value="monthly">חודשי</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">שעת שליחה</label>
              <input
                type="time"
                value={settings.sendTime}
                onChange={e => update("sendTime", e.target.value)}
                className={`${inputClass} w-full`}
              />
            </div>
            {settings.frequency === "weekly" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">יום בשבוע</label>
                <select
                  value={settings.weekday}
                  onChange={e => update("weekday", Number(e.target.value))}
                  className={`${inputClass} w-full`}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={i} value={i}>יום {d}</option>
                  ))}
                </select>
              </div>
            )}
            {settings.frequency === "monthly" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">יום בחודש</label>
                <select
                  value={settings.monthDay}
                  onChange={e => update("monthDay", Number(e.target.value))}
                  className={`${inputClass} w-full`}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-3">
          <div className="text-sm font-semibold">נמענים</div>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="הזן כתובת מייל..."
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecipient())}
              className={`${inputClass} flex-1`}
              dir="ltr"
            />
            <button
              onClick={addRecipient}
              className="h-10 inline-flex items-center gap-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              הוסף
            </button>
          </div>
          {settings.recipients.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
              לא הוגדרו נמענים — הוסף לפחות נמען אחד כדי להפעיל שליחה אוטומטית
            </div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {settings.recipients.map(email => (
                <li key={email} className="flex items-center justify-between px-3 py-2 bg-background/40 hover:bg-muted/30 transition">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-inter" dir="ltr">{email}</span>
                  </div>
                  <button
                    onClick={() => removeRecipient(email)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    aria-label={`הסר ${email}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Content options */}
        <div className="space-y-3">
          <div className="text-sm font-semibold">תכולת הדוח</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: "includeProjectBreakdown", label: "פירוט לפי פרויקט" },
              { key: "includeStationBreakdown", label: "פירוט לפי תחנה" },
              { key: "includeRejects", label: "כמות פסולים" },
              { key: "includeAvgTime", label: "זמן ממוצע ליחידה" },
            ].map(opt => {
              const k = opt.key as keyof ReportSettings;
              const checked = settings[k] as boolean;
              return (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/40 hover:bg-muted/30 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => update(k, e.target.checked as never)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => toast({ title: "ההגדרות נשמרו", description: "הגדרות הדוחות עודכנו בהצלחה" })}
            className="h-10 inline-flex items-center gap-2 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition"
          >
            שמור שינויים
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
