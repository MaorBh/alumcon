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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">כל הפרויקטים</h2>
        <Button onClick={() => setDialogOpen(true)}>
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
          const inProgress = items.filter(i => i.status === "in_progress").length;
          const rejected = items.filter(i => i.status === "rejected").length;

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

              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div>
                  <p className="text-xl font-bold font-inter">{project.totalItems}</p>
                  <p className="text-xs text-muted-foreground">סה״כ</p>
                </div>
                <div>
                  <p className="text-xl font-bold font-inter text-status-completed">{project.completedItems}</p>
                  <p className="text-xs text-muted-foreground">הושלמו</p>
                </div>
                <div>
                  <p className="text-xl font-bold font-inter text-status-rejected">{rejected}</p>
                  <p className="text-xs text-muted-foreground">נפסלו</p>
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
  );
}
