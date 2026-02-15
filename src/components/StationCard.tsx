import { StationId } from "@/data/mockData";

const stationColors: Record<StationId, string> = {
  cnc: "var(--station-cnc)",
  frames: "var(--station-frames)",
  glazing: "var(--station-glazing)",
  finishes: "var(--station-finishes)",
  windows: "var(--station-windows)",
  vitrines: "var(--station-vitrines)",
};

interface StationCardProps {
  name: string;
  stationId: StationId;
  active: number;
  completed: number;
  rejected: number;
}

export default function StationCard({ name, stationId, active, completed, rejected }: StationCardProps) {
  const total = active + completed + rejected;
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const color = stationColors[stationId];

  return (
    <div className="glass-card p-4 hover:border-primary/20 transition-all duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: `hsl(${color})` }}
        />
        <h3 className="font-semibold text-sm">{name}</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">פעילים כעת</span>
          <span className="font-inter font-semibold text-foreground">{active}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">הושלמו</span>
          <span className="font-inter font-semibold text-status-completed">{completed}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">נפסלו</span>
          <span className="font-inter font-semibold text-status-rejected">{rejected}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${completedPct}%`,
              backgroundColor: `hsl(${color})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
