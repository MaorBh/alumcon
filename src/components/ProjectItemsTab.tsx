import { useState, useMemo } from "react";
import { STATIONS, ItemStatus, ProjectItem } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Search } from "lucide-react";

type QcStatus = "not_checked" | "approved" | "failed";

const qcLabel: Record<QcStatus, string> = {
  not_checked: "טרם נבדק",
  approved: "אושר QC",
  failed: "נכשל QC",
};

function getQcStatus(item: ProjectItem): QcStatus {
  if (item.qcApproved) return "approved";
  if (item.stationHistory.some(h => h.result === "fail")) return "failed";
  return "not_checked";
}

export default function ProjectItemsTab({ items }: { items: ProjectItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [stationFilter, setStationFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search || item.barcode.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchStation = stationFilter === "all" || item.currentStation === stationFilter;
      return matchSearch && matchStatus && matchStation;
    }).slice(0, 100);
  }, [items, search, statusFilter, stationFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="surface-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש לפי ברקוד..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 bg-background/60 border border-border rounded-lg pr-10 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ItemStatus | "all")}
          className="h-10 bg-background/60 border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="in_progress">בתהליך</option>
          <option value="completed">הושלם</option>
          <option value="rejected">נפסל</option>
        </select>
        <select
          value={stationFilter}
          onChange={e => setStationFilter(e.target.value)}
          className="h-10 bg-background/60 border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
        >
          <option value="all">כל התחנות</option>
          {STATIONS.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground mr-auto">
          מציג <span className="font-inter font-semibold text-foreground tabular-nums">{filtered.length}</span> מתוך <span className="font-inter tabular-nums">{items.length}</span>
        </span>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["ברקוד", "סוג", "חזית", "קומה", "יחידה", "תחנה נוכחית", "סטטוס", "QC"].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const currentStationName = STATIONS.find(s => s.id === item.currentStation)?.name || "-";
                const qcStatus = getQcStatus(item);
                return (
                  <tr key={item.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-inter text-xs font-mono">{item.barcode}</td>
                    <td className="px-4 py-3 text-xs">{item.type}</td>
                    <td className="px-4 py-3 text-xs">{item.side}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums">{item.floor}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums">{item.unit}</td>
                    <td className="px-4 py-3 text-xs">{currentStationName}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        qcStatus === "approved" ? "text-status-completed" :
                        qcStatus === "failed" ? "text-status-rejected" : "text-muted-foreground"
                      }`}>{qcLabel[qcStatus]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
