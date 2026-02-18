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
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש ברקוד..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg pr-10 pl-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ItemStatus | "all")}
          className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">כל התחנות</option>
          {STATIONS.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">מציג {filtered.length} מתוך {items.length} פריטים</p>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">ברקוד</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">סוג</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">חזית</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">קומה</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">יחידה</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">תחנה נוכחית</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">סטטוס</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">QC</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const currentStationName = STATIONS.find(s => s.id === item.currentStation)?.name || "-";
              const qcStatus = getQcStatus(item);
              return (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-inter text-xs font-mono">{item.barcode}</td>
                  <td className="p-3 text-xs">{item.type}</td>
                  <td className="p-3 text-xs">{item.side}</td>
                  <td className="p-3 text-xs font-inter">{item.floor}</td>
                  <td className="p-3 text-xs font-inter">{item.unit}</td>
                  <td className="p-3 text-xs">{currentStationName}</td>
                  <td className="p-3"><StatusBadge status={item.status} /></td>
                  <td className="p-3">
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
  );
}
