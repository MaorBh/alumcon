import { getStationStats } from "@/data/mockData";
import StationCard from "@/components/StationCard";

export default function Stations() {
  const stats = getStationStats();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">תחנות ייצור</h2>
        <p className="text-sm text-muted-foreground mt-1">סטטוס כל תחנה במפעל</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(s => (
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
  );
}
