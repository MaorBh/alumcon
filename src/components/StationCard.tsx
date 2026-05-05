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
    <div className="surface-card p-4 hover:border-primary/20 hover-lift">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: `hsl(${color})`, boxShadow: `0 0 12px hsl(${color} / 0.6)` }}
          />
          <h3 className="font-semibold text-sm truncate">{name}</h3>
        </div>
        <span className="text-[11px] font-inter font-semibold text-muted-foreground tabular-nums">
          {completedPct.toFixed(0)}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-base font-bold font-inter tabular-nums">{active}</p>
          <p className="text-[10px] text-muted-foreground">פעיל</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold font-inter tabular-nums text-status-completed">{completed}</p>
          <p className="text-[10px] text-muted-foreground">הושלם</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold font-inter tabular-nums text-status-rejected">{rejected}</p>
          <p className="text-[10px] text-muted-foreground">נפסל</p>
        </div>
      </div>

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
  );
}
