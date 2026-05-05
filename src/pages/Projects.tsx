import { useState } from "react";
import { PROJECTS, PROJECT_ITEMS, addProject } from "@/data/mockData";
import { Link } from "react-router-dom";
import { FolderKanban, Calendar, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateProjectDialog from "@/components/CreateProjectDialog";

export default function Projects() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  const handleProjectCreated = (data: any) => {
    addProject({
      name: data.name,
      description: data.description,
      sides: data.sides,
      floors: Array.from({ length: data.floorTo - data.floorFrom + 1 }, (_, i) => data.floorFrom + i),
      unitsPerFloor: data.unitsPerFloor,
    });
    forceUpdate(n => n + 1);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">כל הפרויקטים</h2>
          <p className="text-sm text-muted-foreground mt-1">{PROJECTS.length} פרויקטים פעילים במערכת</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shadow-glow">
          <Plus className="w-4 h-4" />
          פרויקט חדש
        </Button>
      </div>

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onProjectCreated={handleProjectCreated}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROJECTS.map(project => {
          const items = PROJECT_ITEMS[project.id] || [];
          const pct = project.totalItems > 0 ? (project.completedItems / project.totalItems * 100) : 0;
          const rejected = items.filter(i => i.status === "rejected").length;

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

              <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                <div className="space-y-0.5">
                  <p className="text-xl font-bold font-inter tabular-nums">{project.totalItems}</p>
                  <p className="text-xs text-muted-foreground">סה״כ</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold font-inter tabular-nums text-status-completed">{project.completedItems}</p>
                  <p className="text-xs text-muted-foreground">הושלמו</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold font-inter tabular-nums text-status-rejected">{rejected}</p>
                  <p className="text-xs text-muted-foreground">נפסלו</p>
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
    </div>
  );
}
