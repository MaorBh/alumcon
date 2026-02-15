import { PROJECT_ITEMS, STATIONS, ItemStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";

export default function Items() {
  const allItems = Object.values(PROJECT_ITEMS).flat();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [stationFilter, setStationFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const matchSearch = !search || item.barcode.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchStation = stationFilter === "all" || item.currentStation === stationFilter;
      return matchSearch && matchStatus && matchStation;
    }).slice(0, 100); // limit display
  }, [allItems, search, statusFilter, stationFilter]);

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

      <p className="text-xs text-muted-foreground">מציג {filtered.length} מתוך {allItems.length} פריטים</p>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">ברקוד</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">סוג</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">חזית</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">קומה</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">יחידה</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">סטטוס</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">תחנה נוכחית</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">QC</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">התקדמות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const currentStationName = STATIONS.find(s => s.id === item.currentStation)?.name || "-";
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs font-inter">{item.barcode}</td>
                    <td className="p-3 text-xs">{item.type}</td>
                    <td className="p-3 text-xs">{item.side}</td>
                    <td className="p-3 text-xs font-inter">{item.floor}</td>
                    <td className="p-3 text-xs font-inter">{item.unit}</td>
                    <td className="p-3"><StatusBadge status={item.status} /></td>
                    <td className="p-3 text-xs">{currentStationName}</td>
                    <td className="p-3 text-xs">
                      {item.qcApproved ? (
                        <span className="text-status-completed">✓</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-0.5">
                        {STATIONS.map(s => {
                          const hist = item.stationHistory.find(h => h.station === s.id);
                          return (
                            <div
                              key={s.id}
                              className="w-3 h-1.5 rounded-full"
                              style={{
                                backgroundColor: hist
                                  ? hist.result === "pass"
                                    ? "hsl(var(--status-completed))"
                                    : "hsl(var(--status-rejected))"
                                  : "hsl(var(--muted))",
                              }}
                            />
                          );
                        })}
                      </div>
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
