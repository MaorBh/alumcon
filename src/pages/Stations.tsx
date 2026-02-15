import { getStationStats, STATIONS } from "@/data/mockData";
import StationCard from "@/components/StationCard";

export default function Stations() {
  const stats = getStationStats();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">תחנות ייצור</h2>
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
