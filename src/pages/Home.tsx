import { PROJECTS, PROJECT_ITEMS, getStationStats } from "@/data/mockData";
import { Link } from "react-router-dom";
import { FolderKanban, Calendar, ArrowLeft, Package, CheckCircle, AlertTriangle, Clock, Factory } from "lucide-react";
import KpiCard from "@/components/KpiCard";

export default function Home() {
  const allItems = Object.values(PROJECT_ITEMS).flat();
  const totalItems = allItems.length;
  const completed = allItems.filter(i => i.status === "completed").length;
  const inProgress = allItems.filter(i => i.status === "in_progress").length;
  const rejected = allItems.filter(i => i.status === "rejected").length;

  return (
    <div className="space-y-6">
      {/* Global KPIs */}
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

      {/* Projects Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4">פרויקטים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTS.map(project => {
            const items = PROJECT_ITEMS[project.id] || [];
            const pct = project.totalItems > 0 ? (project.completedItems / project.totalItems * 100) : 0;
            const projInProgress = items.filter(i => i.status === "in_progress").length;
            const projRejected = items.filter(i => i.status === "rejected").length;
            const projPending = items.filter(i => i.status === "pending").length;

            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="glass-card p-5 hover:border-primary/30 transition-all duration-300 group block"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold">{project.name}</h3>
                      <p className="text-xs text-muted-foreground">{project.description}</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  <div>
                    <p className="text-lg font-bold font-inter">{project.totalItems}</p>
                    <p className="text-[10px] text-muted-foreground">סה״כ</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-inter text-status-completed">{project.completedItems}</p>
                    <p className="text-[10px] text-muted-foreground">הושלמו</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-inter text-status-in-progress">{projInProgress}</p>
                    <p className="text-[10px] text-muted-foreground">בתהליך</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-inter text-status-rejected">{projRejected}</p>
                    <p className="text-[10px] text-muted-foreground">נפסלו</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">התקדמות</span>
                    <span className="font-inter font-semibold">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{project.createdAt}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
