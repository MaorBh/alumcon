import { ItemStatus } from "@/data/mockData";

const statusConfig: Record<ItemStatus, { label: string; className: string }> = {
  pending: { label: "ממתין", className: "bg-status-pending text-status-pending-fg" },
  in_progress: { label: "בתהליך", className: "bg-status-progress text-status-progress-fg" },
  completed: { label: "הושלם", className: "bg-status-completed text-status-completed-fg" },
  rejected: { label: "נפסל", className: "bg-status-rejected text-status-rejected-fg" },
};

export default function StatusBadge({ status }: { status: ItemStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
