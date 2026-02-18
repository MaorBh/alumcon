import { useParams, Link } from "react-router-dom";
import { PROJECTS, PROJECT_ITEMS, STATIONS, ItemStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import ProjectItemsTab from "@/components/ProjectItemsTab";
import KpiCard from "@/components/KpiCard";
import StationCard from "@/components/StationCard";
import { ArrowRight, Building2, Package, CheckCircle, AlertTriangle, Clock, LayoutDashboard, Grid3X3, List, Settings } from "lucide-react";
import { useState, useMemo } from "react";

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

type Tab = "dashboard" | "grid" | "items" | "settings";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "דשבורד", icon: LayoutDashboard },
  { id: "grid", label: "גריד", icon: Grid3X3 },
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
  }, [items]);

  const recentItems = useMemo(() => {
    return items
      .filter(i => i.stationHistory.length > 0)
      .sort((a, b) => {
        const aLast = a.stationHistory[a.stationHistory.length - 1]?.timestamp || "";
        const bLast = b.stationHistory[b.stationHistory.length - 1]?.timestamp || "";
        return bLast.localeCompare(aLast);
      })
      .slice(0, 8);
  }, [items]);

  const sideItems = useMemo(() => items.filter(i => i.side === activeSide), [items, activeSide]);
  const floors = project?.floors || [];
  const reversedFloors = [...floors].reverse();
  const floorItems = useMemo(() => {
    if (!selectedFloor) return [];
    return sideItems.filter(i => i.floor === selectedFloor);
  }, [sideItems, selectedFloor]);

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">פרויקט לא נמצא</div>;
  }

  const maxUnitsPerFloor = sideItems.length > 0 ? Math.max(...sideItems.map(i => i.unit)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.description}</p>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-border pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
            <h2 className="text-lg font-bold">פעילות אחרונה</h2>
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">ברקוד</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">סוג</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">תחנה אחרונה</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">סטטוס</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">קומה</th>
                  </tr>
                </thead>
                <tbody>
                  {recentItems.map(item => {
                    const lastStation = item.stationHistory[item.stationHistory.length - 1];
                    const stationName = STATIONS.find(s => s.id === lastStation?.station)?.name || "-";
                    return (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-inter text-xs font-mono">{item.barcode}</td>
                        <td className="p-3 text-xs">{item.type}</td>
                        <td className="p-3 text-xs">{stationName}</td>
                        <td className="p-3"><StatusBadge status={item.status} /></td>
                        <td className="p-3 text-xs font-inter">{item.floor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "grid" && (
        <div className="space-y-4">
          {/* Side selector */}
          <div className="flex gap-2 flex-wrap">
            {project.sides.map(side => {
              const sItems = items.filter(i => i.side === side);
              const sCompleted = sItems.filter(i => i.status === "completed").length;
              const pct = sItems.length > 0 ? ((sCompleted / sItems.length) * 100).toFixed(0) : "0";
              return (
                <button
                  key={side}
                  onClick={() => { setActiveSide(side); setSelectedFloor(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeSide === side
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {side} ({pct}%)
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">גריד חזית - {activeSide}</h3>
                </div>

                <div className="flex gap-6 mb-4 flex-wrap">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold">סטטוס ייצור (עליון)</p>
                    <div className="flex gap-3">
                      {(["pending", "in_progress", "completed", "rejected"] as ItemStatus[]).map(status => (
                        <div key={status} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: statusToColor[status] }} />
                          <StatusBadge status={status} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold">בקרת איכות (תחתון)</p>
                    <div className="flex gap-3">
                      {(["not_checked", "approved", "failed"] as QcStatus[]).map(qc => (
                        <div key={qc} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: qcToColor[qc] }} />
                          <span className="text-xs text-muted-foreground">{qcLabel[qc]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div>
                    {reversedFloors.map(floor => {
                      const floorData = sideItems.filter(i => i.floor === floor);
                      return (
                        <div
                          key={floor}
                          className={`flex items-center gap-1.5 mb-1.5 cursor-pointer rounded px-1 transition-colors ${
                            selectedFloor === floor ? "bg-primary/10" : "hover:bg-muted/50"
                          }`}
                          onClick={() => setSelectedFloor(floor)}
                        >
                          <span className="w-10 text-sm font-inter text-muted-foreground font-mono shrink-0 text-center">{floor}</span>
                          <div className="flex gap-1 flex-1">
                            {Array.from({ length: maxUnitsPerFloor }, (_, u) => {
                              const item = floorData.find(i => i.unit === u + 1);
                              const qcStatus = item ? getQcStatus(item) : "not_checked";
                              return (
                                <div
                                  key={u}
                                  className="h-14 flex-1 min-w-0 rounded-md border border-border/40 transition-all duration-200 hover:scale-105 hover:z-10 relative group flex flex-col overflow-hidden"
                                  title={item ? `${item.barcode} - ${item.type}` : "ריק"}
                                >
                                  <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: item ? statusToColor[item.status] : "hsl(var(--muted))" }}>
                                    {item && (
                                      <span className="text-[9px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none text-center px-0.5 truncate">
                                        {item.barcode}
                                      </span>
                                    )}
                                  </div>
                                  <div className="h-px bg-background/50" />
                                  <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: item ? qcToColor[qcStatus] : "hsl(var(--muted))" }}>
                                    {item && (
                                      <span className="text-[8px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none">
                                        {qcStatus === "approved" ? "✓ QC" : qcStatus === "failed" ? "✗ QC" : "—"}
                                      </span>
                                    )}
                                  </div>
                                  {item && (
                                    <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-1 hidden group-hover:block z-20 bg-popover border border-border rounded px-2 py-1.5 text-xs whitespace-nowrap shadow-lg">
                                      <p className="font-mono font-bold">{item.barcode}</p>
                                      <p>{item.type}</p>
                                      <p className="text-muted-foreground">QC: {qcLabel[qcStatus]}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky top-4 self-start">
              <div className="glass-card p-4">
                <h3 className="font-semibold text-sm mb-3">
                  {selectedFloor ? `קומה ${selectedFloor} - פרטי פריטים` : "לחץ על קומה לפרטים"}
                </h3>
                {selectedFloor ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {floorItems.map(item => {
                      const lastStation = item.stationHistory[item.stationHistory.length - 1];
                      const stationName = STATIONS.find(s => s.id === lastStation?.station)?.name;
                      return (
                        <div key={item.id} className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-inter">{item.barcode}</span>
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="text-xs text-muted-foreground">{item.type} • יחידה {item.unit}</p>
                          {stationName && (
                            <p className="text-xs text-muted-foreground">תחנה אחרונה: <span className="text-foreground">{stationName}</span></p>
                          )}
                          <div className="flex gap-1 pt-1">
                            {STATIONS.map(s => {
                              const hist = item.stationHistory.find(h => h.station === s.id);
                              return (
                                <div
                                  key={s.id}
                                  className="w-4 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor: hist
                                      ? hist.result === "pass" ? "hsl(var(--status-completed))" : "hsl(var(--status-rejected))"
                                      : "hsl(var(--muted))",
                                  }}
                                  title={`${s.name}: ${hist ? (hist.result === "pass" ? "עבר" : "נכשל") : "טרם"}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">בחר קומה בגריד כדי לראות פרטים</p>
                )}
              </div>
            </div>
          </div>
        </div>
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
