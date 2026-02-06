import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  subtitle?: string;
}

export function MetricCard({ label, value, icon: Icon, trend, subtitle }: MetricCardProps) {
  return (
    <div className="bg-card rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {trend && (
          <span className="text-xs font-semibold text-success px-2 py-1 bg-success/10 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
