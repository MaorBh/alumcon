import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { STATIONS, ItemStatus, ProjectItem, updateItemStatus, updateItemQc, QcStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import ItemPhotosDialog from "@/components/ItemPhotosDialog";
import { SCAN_LOG } from "@/scan/scanData";
import { Search, ImageIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

const qcLabel: Record<QcStatus, string> = {
  not_checked: "טרם נבדק",
  approved: "אושר QC",
  failed: "נכשל QC",
};

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: "pending", label: "ממתין" },
  { value: "in_progress", label: "בתהליך" },
  { value: "completed", label: "הושלם" },
  { value: "rejected", label: "נפסל" },
];

const QC_OPTIONS: { value: QcStatus; label: string }[] = [
  { value: "not_checked", label: "טרם נבדק" },
  { value: "approved", label: "אושר QC" },
  { value: "failed", label: "נכשל QC" },
];

function getQcStatus(item: ProjectItem): QcStatus {
  if (item.qcApproved) return "approved";
  if (item.stationHistory.some(h => h.result === "fail")) return "failed";
  return "not_checked";
}

export default function ProjectItemsTab({ items }: { items: ProjectItem[] }) {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEditQc = user?.role === "qc" || user?.role === "admin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [, setRefreshKey] = useState(0);
  const [photosFor, setPhotosFor] = useState<{ itemId: string; barcode: string } | null>(null);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search || item.barcode.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchStation = stationFilter === "all" || item.currentStation === stationFilter;
      return matchSearch && matchStatus && matchStation;
    }).slice(0, 100);
  }, [items, search, statusFilter, stationFilter]);

  const handleStatusChange = (itemId: string, newStatus: ItemStatus) => {
    if (!projectId) return;
    updateItemStatus(projectId, itemId, newStatus);
    setRefreshKey(k => k + 1);
  };

  const handleQcChange = (itemId: string, newQc: QcStatus) => {
    if (!projectId) return;
    updateItemQc(projectId, itemId, newQc);
    setRefreshKey(k => k + 1);
  };

  const selectClass =
    "h-8 min-w-[120px] bg-background/60 border border-border rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition";

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
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
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
                {["ברקוד", "סוג", "חזית", "קומה", "מיקום", "תחנה נוכחית", "סטטוס", "QC", "תמונות"].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const currentStationName = STATIONS.find(s => s.id === item.currentStation)?.name || "-";
                const qcStatus = getQcStatus(item);
                const photoCount = SCAN_LOG.filter(r => r.itemId === item.id).reduce((s, r) => s + r.photos.length, 0);
                return (
                  <tr key={item.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors align-middle">
                    <td className="px-4 py-3 font-inter text-xs font-mono">{item.barcode}</td>
                    <td className="px-4 py-3 text-xs">{item.type}</td>
                    <td className="px-4 py-3 text-xs">{item.side}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums">{item.floor}</td>
                    <td className="px-4 py-3 text-xs font-inter tabular-nums">{item.unit}</td>
                    <td className="px-4 py-3 text-xs">{currentStationName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status} />
                        <select
                          value={item.status}
                          onChange={e => handleStatusChange(item.id, e.target.value as ItemStatus)}
                          className={selectClass}
                          aria-label="עדכון סטטוס"
                        >
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium whitespace-nowrap ${
                          qcStatus === "approved" ? "text-status-completed" :
                          qcStatus === "failed" ? "text-status-rejected" : "text-muted-foreground"
                        }`}>{qcLabel[qcStatus]}</span>
                        {canEditQc && (
                          <select
                            value={qcStatus}
                            onChange={e => handleQcChange(item.id, e.target.value as QcStatus)}
                            className={selectClass}
                            aria-label="עדכון QC"
                          >
                            {QC_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => photoCount > 0 && setPhotosFor({ itemId: item.id, barcode: item.barcode })}
                        disabled={photoCount === 0}
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition ${
                          photoCount > 0
                            ? "border-border bg-background/60 text-foreground hover:bg-secondary hover:border-primary cursor-pointer"
                            : "border-border/40 bg-muted/20 text-muted-foreground/60 cursor-not-allowed"
                        }`}
                        title={photoCount > 0 ? "צפייה בתמונות" : "אין תמונות"}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span className="font-inter tabular-nums">{photoCount}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {photosFor && (
        <ItemPhotosDialog
          itemId={photosFor.itemId}
          barcode={photosFor.barcode}
          onClose={() => setPhotosFor(null)}
        />
      )}
    </div>
  );
}
