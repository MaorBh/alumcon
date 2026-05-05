import { ItemStatus } from "@/data/mockData";

const statusConfig: Record<ItemStatus, { label: string; dot: string; className: string }> = {
  pending: {
    label: "ממתין",
    dot: "bg-status-pending",
    className: "bg-status-pending/15 text-status-pending-fg border-status-pending/30",
  },
  in_progress: {
    label: "בתהליך",
    dot: "bg-status-progress",
    className: "bg-status-progress/15 text-status-progress border-status-progress/30",
  },
  completed: {
    label: "הושלם",
    dot: "bg-status-completed",
    className: "bg-status-completed/15 text-status-completed border-status-completed/30",
  },
  rejected: {
    label: "נפסל",
    dot: "bg-status-rejected",
    className: "bg-status-rejected/15 text-status-rejected border-status-rejected/30",
  },
};

export default function StatusBadge({ status }: { status: ItemStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`status-badge border ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
