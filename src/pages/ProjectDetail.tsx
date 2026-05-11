import { useParams, Link } from "react-router-dom";
import { PROJECTS, PROJECT_ITEMS, STATIONS, ItemStatus, updateItemStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import ProjectItemsTab from "@/components/ProjectItemsTab";
import KpiCard from "@/components/KpiCard";
import StationCard from "@/components/StationCard";
import BimViewer from "@/components/BimViewer";
import { ArrowRight, Package, CheckCircle, AlertTriangle, Clock, LayoutDashboard, List, Settings, Box } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";

const statusToColor: Record<ItemStatus, string> = {
  pending: "hsl(var(--status-pending))",
  in_progress: "hsl(var(--status-in-progress))",
  completed: "hsl(var(--status-completed))",
  rejected: "hsl(var(--status-rejected))",
};

type QcStatus = "not_checked" | "approved" | "failed";

const qcToColor: Record<QcStatus, string> = {
  not_checked: "hsl(var(--muted))",
  approved: "hsl(var(--status-completed))",
  failed: "hsl(var(--status-rejected))",
};

const qcLabel: Record<QcStatus, string> = {
  not_checked: "טרם נבדק",
  approved: "אושר QC",
  failed: "נכשל QC",
};

function getQcStatus(item: { qcApproved: boolean; status: ItemStatus; stationHistory: { result: string }[] }): QcStatus {
  if (item.qcApproved) return "approved";
  if (item.stationHistory.some(h => h.result === "fail")) return "failed";
  return "not_checked";
}

type Tab = "dashboard" | "bim" | "items" | "settings";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "דשבורד", icon: LayoutDashboard },
  { id: "bim", label: "מודל BIM", icon: Box },
  { id: "items", label: "פריטים", icon: List },
  { id: "settings", label: "הגדרות", icon: Settings },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const project = PROJECTS.find(p => p.id === id);
  const items = id ? PROJECT_ITEMS[id] || [] : [];
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [activeSide, setActiveSide] = useState("S-South");
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const totalItems = items.length;
  const completed = items.filter(i => i.status === "completed").length;
  const inProgress = items.filter(i => i.status === "in_progress").length;
  const rejected = items.filter(i => i.status === "rejected").length;

  const projectStationStats = useMemo(() => {
    return STATIONS.map(s => ({
      ...s,
      active: items.filter(i => i.currentStation === s.id && i.status === "in_progress").length,
      completed: items.filter(i => i.stationHistory.some(h => h.station === s.id && h.result === "pass")).length,
      rejected: items.filter(i => i.stationHistory.some(h => h.station === s.id && h.result === "fail")).length,
    }));
  }, [items, refreshKey]);

  const recentItems = useMemo(() => {
    return items
      .filter(i => i.stationHistory.length > 0)
      .sort((a, b) => {
        const aLast = a.stationHistory[a.stationHistory.length - 1]?.timestamp || "";
        const bLast = b.stationHistory[b.stationHistory.length - 1]?.timestamp || "";
        return bLast.localeCompare(aLast);
      })
      .slice(0, 8);
  }, [items, refreshKey]);

  const sideItems = useMemo(() => items.filter(i => i.side === activeSide), [items, activeSide, refreshKey]);
  const floors = project?.floors || [];
  const reversedFloors = [...floors].reverse();
  const floorItems = useMemo(() => {
    if (!selectedFloor) return [];
    return sideItems.filter(i => i.floor === selectedFloor);
  }, [sideItems, selectedFloor, refreshKey]);

  useEffect(() => {
    if (selectedItemId) {
      const el = document.getElementById(`item-${selectedItemId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedItemId]);

  const handleBimStatusChange = useCallback((itemId: string, newStatus: ItemStatus) => {
    if (!id) return;
    updateItemStatus(id, itemId, newStatus);
    setRefreshKey(k => k + 1);
  }, [id]);

  const handleBimSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
  }, []);

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">פרויקט לא נמצא</div>;
  }

  const maxUnitsPerFloor = sideItems.length > 0 ? Math.max(...sideItems.map(i => i.unit)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/projects"
          className="w-10 h-10 rounded-xl border border-border/60 bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all flex items-center justify-center shrink-0"
          aria-label="חזרה לפרויקטים"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight truncate">{project.name}</h2>
          <p className="text-sm text-muted-foreground truncate">{project.description}</p>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="סה״כ פריטים" value={totalItems.toLocaleString()} icon={Package} accentColor="var(--primary)" />
            <KpiCard title="הושלמו" value={completed.toLocaleString()} icon={CheckCircle} subtitle={`${totalItems > 0 ? ((completed / totalItems) * 100).toFixed(1) : 0}%`} accentColor="var(--status-completed)" />
            <KpiCard title="בתהליך" value={inProgress.toLocaleString()} icon={Clock} accentColor="var(--status-in-progress)" />
            <KpiCard title="נפסלו" value={rejected} icon={AlertTriangle} subtitle="דרוש טיפול" accentColor="var(--status-rejected)" />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold">סטטוס תחנות</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {projectStationStats.map(s => (
                <StationCard key={s.id} name={s.name} stationId={s.id} active={s.active} completed={s.completed} rejected={s.rejected} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold tracking-tight">פעילות אחרונה</h3>
            <div className="surface-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["ברקוד", "סוג", "תחנה אחרונה", "סטטוס", "קומה"].map(h => (
                      <th key={h} className="text-right px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentItems.map(item => {
                    const lastStation = item.stationHistory[item.stationHistory.length - 1];
                    const stationName = STATIONS.find(s => s.id === lastStation?.station)?.name || "-";
                    return (
                      <tr key={item.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-inter text-xs font-mono">{item.barcode}</td>
                        <td className="px-4 py-3 text-xs">{item.type}</td>
                        <td className="px-4 py-3 text-xs">{stationName}</td>
                        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-3 text-xs font-inter tabular-nums">{item.floor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "bim" && id && (
        <BimViewer
          projectId={id}
          items={items}
          selectedItemId={selectedItemId}
          onSelectItem={handleBimSelectItem}
          onStatusChange={handleBimStatusChange}
          activeSide={activeSide}
          selectedFloor={selectedFloor}
        />
      )}

      {activeTab === "items" && (
        <ProjectItemsTab items={items} />
      )}

      {activeTab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-lg">פרטי פרויקט</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">שם הפרויקט</p>
                <p className="font-semibold">{project.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">תאריך יצירה</p>
                <p className="font-inter">{project.createdAt}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">תיאור</p>
                <p>{project.description}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">סטטוס</p>
                <p className="font-semibold">{project.status === "active" ? "פעיל" : project.status === "completed" ? "הושלם" : "מושהה"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">חזיתות</p>
                <p>{project.sides.join(", ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">קומות</p>
                <p className="font-inter">{project.floors[0]} - {project.floors[project.floors.length - 1]}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}