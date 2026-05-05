import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  accentColor?: string;
}

export default function KpiCard({ title, value, subtitle, icon: Icon, trend, accentColor }: KpiCardProps) {
  const accent = accentColor ? `hsl(${accentColor})` : "hsl(var(--primary))";
  const accentBg = accentColor ? `hsl(${accentColor} / 0.12)` : "hsl(var(--primary) / 0.12)";
  return (
    <div className="surface-card p-5 relative overflow-hidden group hover:border-primary/30 hover-lift">
      {/* top accent bar */}
      <div
        className="absolute top-0 right-0 left-0 h-[2px] opacity-70"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold font-inter tracking-tight leading-none">{value}</p>
          <div className="flex items-center gap-2 pt-0.5">
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <span
                className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                  trend.positive
                    ? "text-status-completed bg-status-completed/10"
                    : "text-destructive bg-destructive/10"
                }`}
              >
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: accentBg }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}
