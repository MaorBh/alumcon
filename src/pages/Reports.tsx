import { useEffect, useMemo, useState } from "react";
import { PROJECTS, STATIONS, StationId } from "@/data/mockData";
import { SCAN_LOG } from "@/scan/scanData";
import { FileBarChart2, Mail, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface StationStats {
  stationId: StationId;
  stationName: string;
  completed: number;
  rejected: number;
}

function toDateOnly(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isWithinRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function computeStationStats(projectId: string, from: Date, to: Date): StationStats[] {
  return STATIONS.map(s => {
    let completed = 0;
    let rejected = 0;

    SCAN_LOG.forEach(scan => {
      if (scan.projectId !== projectId) return;
      if (scan.stationId !== s.id) return;
      if (!isWithinRange(scan.timestamp, from, to)) return;

      if (scan.action === "station_pass") completed++;
      else if (scan.action === "station_reject" || scan.action === "qc_reject") rejected++;
    });

    return {
      stationId: s.id,
      stationName: s.name,
      completed,
      rejected,
    };
  });
}

export default function Reports() {
  const today = new Date().toISOString().split("T")[0];
  const [fromStr, setFromStr] = useState(today);
  const [toStr, setToStr] = useState(today);
  const [tick, setTick] = useState(0);

  const fromDate = useMemo(() => toDateOnly(new Date(fromStr)), [fromStr]);
  const toDate = useMemo(() => {
    const d = toDateOnly(new Date(toStr));
    d.setHours(23, 59, 59, 999);
    return d;
  }, [toStr]);

  // Live refresh — SCAN_LOG mutates outside React so poll its length
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const projectReports = useMemo(
    () =>
      PROJECTS.map(p => {
        const stations = computeStationStats(p.id, fromDate, toDate);
        const totals = stations.reduce(
          (acc, s) => ({
            completed: acc.completed + s.completed,
            rejected: acc.rejected + s.rejected,
          }),
          { completed: 0, rejected: 0 },
        );
        return { project: p, stations, totals };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fromDate, toDate, tick, SCAN_LOG.length],
  );

  const grandTotals = projectReports.reduce(
    (acc, r) => ({
      completed: acc.completed + r.totals.completed,
      rejected: acc.rejected + r.totals.rejected,
    }),
    { completed: 0, rejected: 0 },
  );

  const totalScansInRange = useMemo(
    () => SCAN_LOG.filter(s => isWithinRange(s.timestamp, fromDate, toDate)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fromDate, toDate, tick],
  );

  const fmt = (iso: string) => format(new Date(iso), "dd/MM/yyyy");
  const rangeLabel = fromStr === toStr ? fmt(fromStr) : `${fmt(fromStr)} ← ${fmt(toStr)}`;

  const buildEmailBody = () => {
    const lines: string[] = [];
    lines.push(`דוח ייצור - ${rangeLabel}`);
    lines.push("");
    lines.push(`הושלמו: ${grandTotals.completed} | פסולים: ${grandTotals.rejected}`);
    lines.push("");
    projectReports.forEach(r => {
      lines.push(`== ${r.project.name} ==`);
      r.stations.forEach(s => {
        lines.push(`${s.stationName}: הושלמו ${s.completed} | פסולים ${s.rejected}`);
      });
      lines.push("");
    });
    return lines.join("\n");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`דוח ייצור - ${rangeLabel}`);
    const body = encodeURIComponent(buildEmailBody());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setFromStr(start.toISOString().split("T")[0]);
    setToStr(end.toISOString().split("T")[0]);
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
            <h2 className="text-lg font-bold text-foreground">דוח ייצור</h2>
            <p className="text-xs text-muted-foreground">
              מבוסס על {totalScansInRange.toLocaleString()} סריקות בטווח הנבחר
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mr-auto flex-wrap">
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => { const d = new Date().toISOString().split("T")[0]; setFromStr(d); setToStr(d); }}
              className="h-8 px-3 text-xs rounded-md border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >היום</button>
            <button
              onClick={() => setQuickRange(7)}
              className="h-8 px-3 text-xs rounded-md border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >7 ימים</button>
            <button
              onClick={() => setQuickRange(30)}
              className="h-8 px-3 text-xs rounded-md border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >30 יום</button>
          </div>
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">מ-</span>
            <input
              type="date"
              value={fromStr}
              max={toStr}
              onChange={e => setFromStr(e.target.value)}
              className="h-10 bg-background/60 border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
            />
            <span className="text-xs text-muted-foreground">עד</span>
            <input
              type="date"
              value={toStr}
              min={fromStr}
              onChange={e => setToStr(e.target.value)}
              className="h-10 bg-background/60 border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
            />
          </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="surface-card p-5">
          <div className="text-xs text-muted-foreground mb-1">בוצעו בטווח</div>
          <div className="text-3xl font-bold font-inter tabular-nums text-status-completed">{grandTotals.completed}</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs text-muted-foreground mb-1">פסולים בטווח</div>
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
              <span className="text-muted-foreground">הושלמו: <span className="font-semibold text-status-completed font-inter tabular-nums">{r.totals.completed}</span></span>
              <span className="text-muted-foreground">פסולים: <span className="font-semibold text-status-rejected font-inter tabular-nums">{r.totals.rejected}</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["תחנה", "הושלמו", "פסולים"].map(h => (
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
                    <td className="px-4 py-3 text-xs font-inter tabular-nums text-status-completed">{s.completed}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums text-status-rejected">{s.rejected}</td>
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
