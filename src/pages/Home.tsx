import { PROJECTS, PROJECT_ITEMS } from "@/data/mockData";
import { Link } from "react-router-dom";
import { FolderKanban, Calendar, ArrowLeft, Package, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import KpiCard from "@/components/KpiCard";

export default function Home() {
  const allItems = Object.values(PROJECT_ITEMS).flat();
  const totalItems = allItems.length;
  const completed = allItems.filter(i => i.status === "completed").length;
  const inProgress = allItems.filter(i => i.status === "in_progress").length;
  const rejected = allItems.filter(i => i.status === "rejected").length;

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">מבט על</h2>
          <p className="text-sm text-muted-foreground mt-1">סטטוס כללי של כל הפרויקטים והייצור</p>
        </div>
      </div>

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
          subtitle={`${totalItems > 0 ? ((completed / totalItems) * 100).toFixed(1) : 0}%`}
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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">פרויקטים</h2>
          <Link to="/projects" className="text-xs font-medium text-primary hover:underline">
            הצג הכל ←
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTS.map(project => {
            const items = PROJECT_ITEMS[project.id] || [];
            const pct = project.totalItems > 0 ? (project.completedItems / project.totalItems * 100) : 0;
            const projInProgress = items.filter(i => i.status === "in_progress").length;
            const projRejected = items.filter(i => i.status === "rejected").length;

            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="surface-card p-5 hover:border-primary/40 hover-lift group block"
              >
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{project.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all shrink-0" />
                </div>

                <div className="grid grid-cols-4 gap-2 mb-5 text-center">
                  <div className="space-y-0.5">
                    <p className="text-lg font-bold font-inter tabular-nums">{project.totalItems}</p>
                    <p className="text-[10px] text-muted-foreground">סה״כ</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-lg font-bold font-inter tabular-nums text-status-completed">{project.completedItems}</p>
                    <p className="text-[10px] text-muted-foreground">הושלמו</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-lg font-bold font-inter tabular-nums text-status-progress">{projInProgress}</p>
                    <p className="text-[10px] text-muted-foreground">בתהליך</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-lg font-bold font-inter tabular-nums text-status-rejected">{projRejected}</p>
                    <p className="text-[10px] text-muted-foreground">נפסלו</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">התקדמות</span>
                    <span className="font-inter font-semibold tabular-nums">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/60 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span className="font-inter">{project.createdAt}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
