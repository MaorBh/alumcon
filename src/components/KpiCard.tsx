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
  return (
    <div className="glass-card p-5 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold font-inter tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium ${trend.positive ? "text-status-completed" : "text-destructive"}`}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accentColor ? `hsl(${accentColor} / 0.15)` : undefined }}
        >
          <Icon
            className="w-5 h-5"
            style={{ color: accentColor ? `hsl(${accentColor})` : undefined }}
          />
        </div>
      </div>
      {/* Subtle accent bar */}
      <div
        className="absolute bottom-0 right-0 left-0 h-0.5 opacity-50 group-hover:opacity-100 transition-opacity"
        style={{ background: accentColor ? `hsl(${accentColor})` : "hsl(var(--primary))" }}
      />
    </div>
  );
}
