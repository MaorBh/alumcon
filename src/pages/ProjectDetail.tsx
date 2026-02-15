import { useParams, Link } from "react-router-dom";
import { PROJECTS, PROJECT_ITEMS, STATIONS, ItemStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { ArrowRight, Building2 } from "lucide-react";
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const project = PROJECTS.find(p => p.id === id);
  const items = id ? PROJECT_ITEMS[id] || [] : [];
  const [activeSide, setActiveSide] = useState("S-South");
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

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

  const maxUnitsPerFloor = Math.max(...sideItems.map(i => i.unit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/projects" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.description}</p>
        </div>
      </div>

      {/* Side selector */}
      <div className="flex gap-2 flex-wrap">
        {project.sides.map(side => {
          const sItems = items.filter(i => i.side === side);
          const completed = sItems.filter(i => i.status === "completed").length;
          const pct = sItems.length > 0 ? ((completed / sItems.length) * 100).toFixed(0) : "0";
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
        {/* Building Grid */}
        <div className="lg:col-span-2">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">גריד חזית - {activeSide}</h3>
            </div>

            {/* Legend */}
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

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                {reversedFloors.map(floor => {
                  const floorData = sideItems.filter(i => i.floor === floor);
                  return (
                    <div
                      key={floor}
                      className={`flex items-center gap-1 mb-1 cursor-pointer rounded px-1 transition-colors ${
                        selectedFloor === floor ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedFloor(floor)}
                    >
                      <span className="w-8 text-xs font-inter text-muted-foreground font-mono shrink-0">
                        {floor}
                      </span>
                      <div className="flex gap-0.5 flex-1">
                        {Array.from({ length: maxUnitsPerFloor }, (_, u) => {
                          const item = floorData.find(i => i.unit === u + 1);
                          const qcStatus = item ? getQcStatus(item) : "not_checked";
                          return (
                            <div
                              key={u}
                              className="h-10 flex-1 rounded-sm border border-border/30 transition-all duration-200 hover:scale-110 hover:z-10 relative group flex flex-col overflow-hidden"
                              style={{ minWidth: "22px" }}
                              title={item ? `${item.barcode} - ${item.type}` : "ריק"}
                            >
                              {/* Top half - Production status */}
                              <div
                                className="flex-1"
                                style={{
                                  backgroundColor: item ? statusToColor[item.status] : "hsl(var(--muted))",
                                }}
                              />
                              {/* Divider line */}
                              <div className="h-px bg-background/40" />
                              {/* Bottom half - QC status */}
                              <div
                                className="flex-1"
                                style={{
                                  backgroundColor: item ? qcToColor[qcStatus] : "hsl(var(--muted))",
                                }}
                              />
                              {item && (
                                <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-1 hidden group-hover:block z-20 bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                                  <p className="font-mono">{item.barcode}</p>
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

        {/* Floor detail */}
        <div>
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
                      <p className="text-xs text-muted-foreground">
                        {item.type} • יחידה {item.unit}
                      </p>
                      {stationName && (
                        <p className="text-xs text-muted-foreground">
                          תחנה אחרונה: <span className="text-foreground">{stationName}</span>
                        </p>
                      )}
                      {/* Station progress dots */}
                      <div className="flex gap-1 pt-1">
                        {STATIONS.map(s => {
                          const hist = item.stationHistory.find(h => h.station === s.id);
                          return (
                            <div
                              key={s.id}
                              className="w-4 h-1.5 rounded-full"
                              style={{
                                backgroundColor: hist
                                  ? hist.result === "pass"
                                    ? "hsl(var(--status-completed))"
                                    : "hsl(var(--status-rejected))"
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
              <p className="text-sm text-muted-foreground text-center py-10">
                בחר קומה בגריד כדי לראות פרטים
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
