import { ProjectItem } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { getProjectName, getStationName } from "./scanData";

export default function ItemInfoCard({ item, projectId }: { item: ProjectItem; projectId: string }) {
  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">ברקוד</div>
          <div className="font-mono text-sm font-bold truncate">{item.barcode}</div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Field label="פרויקט" value={getProjectName(projectId)} />
        <Field label="סוג" value={item.type} />
        <Field label="חזית" value={item.side} />
        <Field label="תחנה נוכחית" value={getStationName(item.currentStation)} />
        <Field label="קומה" value={String(item.floor)} mono />
        <Field label="יחידה" value={String(item.unit)} mono />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${mono ? "font-mono tabular-nums" : ""}`}>{value}</div>
    </div>
  );
}
