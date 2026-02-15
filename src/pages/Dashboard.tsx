import { Package, CheckCircle, AlertTriangle, Clock, Factory, TrendingUp } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import StationCard from "@/components/StationCard";
import { PROJECTS, PROJECT_ITEMS, getStationStats, STATIONS } from "@/data/mockData";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";

export default function Dashboard() {
  const allItems = Object.values(PROJECT_ITEMS).flat();
  const totalItems = allItems.length;
  const completed = allItems.filter(i => i.status === "completed").length;
  const inProgress = allItems.filter(i => i.status === "in_progress").length;
  const rejected = allItems.filter(i => i.status === "rejected").length;
  const stationStats = getStationStats();

  const recentItems = allItems
    .filter(i => i.stationHistory.length > 0)
    .sort((a, b) => {
      const aLast = a.stationHistory[a.stationHistory.length - 1]?.timestamp || "";
      const bLast = b.stationHistory[b.stationHistory.length - 1]?.timestamp || "";
      return bLast.localeCompare(aLast);
    })
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="סה״כ פריטים"
          value={totalItems.toLocaleString()}
          icon={Package}
          subtitle={`${PROJECTS.length} פרויקטים`}
          accentColor="var(--primary)"
        />
        <KpiCard
          title="הושלמו"
          value={completed.toLocaleString()}
          icon={CheckCircle}
          subtitle={`${((completed / totalItems) * 100).toFixed(1)}%`}
          trend={{ value: 12, positive: true }}
          accentColor="var(--status-completed)"
        />
        <KpiCard
          title="בתהליך"
          value={inProgress.toLocaleString()}
          icon={Clock}
          accentColor="var(--status-in-progress)"
        />
        <KpiCard
          title="נפסלו"
          value={rejected}
          icon={AlertTriangle}
          subtitle="דרוש טיפול"
          accentColor="var(--status-rejected)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Station Overview */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold">סטטוס תחנות</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stationStats.map(s => (
              <StationCard
                key={s.id}
                name={s.name}
                stationId={s.id}
                active={s.active}
                completed={s.completed}
                rejected={s.rejected}
              />
            ))}
          </div>
        </div>

        {/* Projects quick list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">פרויקטים</h2>
            <Link to="/projects" className="text-xs text-primary hover:underline">
              הצג הכל
            </Link>
          </div>
          <div className="space-y-2">
            {PROJECTS.map(p => {
              const pct = p.totalItems > 0 ? (p.completedItems / p.totalItems * 100) : 0;
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="glass-card p-4 block hover:border-primary/30 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <span className="text-xs text-muted-foreground font-inter">{pct.toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{p.description}</p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent activity */}
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
  );
}
