import { useEffect, useMemo, useState } from "react";
import { PROJECTS, STATIONS, StationId } from "@/data/mockData";
import { SCAN_LOG, ScanRecord } from "@/scan/scanData";
import { FileBarChart2, Mail, Calendar, RefreshCw } from "lucide-react";

interface StationStats {
  stationId: StationId;
  stationName: string;
  completedToday: number;
  rejectedToday: number;
  avgMinutes: number | null;
}

function isSameDay(iso: string, date: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

/**
 * Compute stats from the live SCAN_LOG (real scans) for a single project.
 * - completedToday: count of station_pass scans at this station today
 * - rejectedToday: count of station_reject + qc_reject scans at this station today
 * - avgMinutes: avg time between the previous scan on the same item and the
 *   scan that landed it at this station (today)
 */
function computeStationStats(projectId: string, date: Date): StationStats[] {
  // Index project scans chronologically by item
  const projectScans = SCAN_LOG
    .filter(s => s.projectId === projectId)
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const scansByItem = new Map<string, ScanRecord[]>();
  for (const s of projectScans) {
    if (!scansByItem.has(s.itemId)) scansByItem.set(s.itemId, []);
    scansByItem.get(s.itemId)!.push(s);
  }

  return STATIONS.map(s => {
    let completedToday = 0;
    let rejectedToday = 0;
    const durations: number[] = [];

    scansByItem.forEach(itemScans => {
      itemScans.forEach((scan, idx) => {
        if (!isSameDay(scan.timestamp, date)) return;
        if (scan.stationId !== s.id) return;

        if (scan.action === "station_pass") {
          completedToday++;
          const prev = itemScans[idx - 1];
          if (prev) {
            const ms = new Date(scan.timestamp).getTime() - new Date(prev.timestamp).getTime();
            if (ms > 0 && ms < 1000 * 60 * 60 * 48) durations.push(ms / 60000);
          }
        } else if (scan.action === "station_reject" || scan.action === "qc_reject") {
          rejectedToday++;
        }
      });
    });

    const avgMinutes = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

    return {
      stationId: s.id,
      stationName: s.name,
      completedToday,
      rejectedToday,
      avgMinutes,
    };
  });
}

function formatMinutes(m: number | null) {
  if (m == null) return "—";
  if (m < 60) return `${m.toFixed(0)} ד׳`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return `${h}:${String(min).padStart(2, "0")} ש׳`;
}

export default function Reports() {
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split("T")[0]);
  const date = useMemo(() => new Date(dateStr), [dateStr]);
  const [tick, setTick] = useState(0);

  // Live refresh — SCAN_LOG mutates outside React so poll its length
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const projectReports = useMemo(
    () =>
      PROJECTS.map(p => {
        const stations = computeStationStats(p.id, date);
        const totals = stations.reduce(
          (acc, s) => ({
            completed: acc.completed + s.completedToday,
            rejected: acc.rejected + s.rejectedToday,
          }),
          { completed: 0, rejected: 0 },
        );
        return { project: p, stations, totals };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, tick, SCAN_LOG.length],
  );

  const grandTotals = projectReports.reduce(
    (acc, r) => ({
      completed: acc.completed + r.totals.completed,
      rejected: acc.rejected + r.totals.rejected,
    }),
    { completed: 0, rejected: 0 },
  );

  const totalScansToday = useMemo(
    () => SCAN_LOG.filter(s => isSameDay(s.timestamp, date)).length,
    [date, tick],
  );

  const buildEmailBody = () => {
    const lines: string[] = [];
    lines.push(`דוח יומי - ${dateStr}`);
    lines.push("");
    lines.push(
      `סה"כ בתחנות: ${grandTotals.inStation} | הושלמו היום: ${grandTotals.completed} | פסולים היום: ${grandTotals.rejected}`,
    );
    lines.push("");
    projectReports.forEach(r => {
      lines.push(`== ${r.project.name} ==`);
      r.stations.forEach(s => {
        lines.push(
          `${s.stationName}: בתחנה ${s.inStation} | הושלמו ${s.completedToday} | פסולים ${s.rejectedToday} | זמן ממוצע ${formatMinutes(s.avgMinutes)}`,
        );
      });
      lines.push("");
    });
    return lines.join("\n");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`דוח ייצור יומי - ${dateStr}`);
    const body = encodeURIComponent(buildEmailBody());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface-card p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <FileBarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">דוח ייצור יומי</h2>
            <p className="text-xs text-muted-foreground">
              מבוסס על {totalScansToday.toLocaleString()} סריקות שבוצעו בתאריך הנבחר
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mr-auto">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            className="h-10 bg-background/60 border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
          />
          <button
            onClick={() => setTick(t => t + 1)}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            title="רענון"
            aria-label="רענון"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleEmail}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition"
          >
            <Mail className="w-4 h-4" />
            שלח במייל
          </button>
        </div>
      </div>

      {/* Grand totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-5">
          <div className="text-xs text-muted-foreground mb-1">פריטים פעילים בתחנות</div>
          <div className="text-3xl font-bold font-inter tabular-nums text-foreground">{grandTotals.inStation}</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs text-muted-foreground mb-1">בוצעו היום</div>
          <div className="text-3xl font-bold font-inter tabular-nums text-status-completed">{grandTotals.completed}</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs text-muted-foreground mb-1">פסולים היום</div>
          <div className="text-3xl font-bold font-inter tabular-nums text-status-rejected">{grandTotals.rejected}</div>
        </div>
      </div>

      {/* Per-project tables */}
      {projectReports.map(r => (
        <div key={r.project.id} className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">{r.project.name}</h3>
              <p className="text-xs text-muted-foreground">{r.project.description}</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">בתחנות: <span className="font-semibold text-foreground font-inter tabular-nums">{r.totals.inStation}</span></span>
              <span className="text-muted-foreground">הושלמו: <span className="font-semibold text-status-completed font-inter tabular-nums">{r.totals.completed}</span></span>
              <span className="text-muted-foreground">פסולים: <span className="font-semibold text-status-rejected font-inter tabular-nums">{r.totals.rejected}</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["תחנה", "פעיל בתחנה", "הושלמו היום", "פסולים היום", "זמן ממוצע ליחידה"].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.stations.map(s => (
                  <tr key={s.stationId} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{s.stationName}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums">{s.inStation}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums text-status-completed">{s.completedToday}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums text-status-rejected">{s.rejectedToday}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums text-muted-foreground">{formatMinutes(s.avgMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
