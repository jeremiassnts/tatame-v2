type KpiCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
};

export function KpiCard({ label, value, subtitle, valueColor = "text-text-primary" }: KpiCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-[14px] border border-border bg-surface p-5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className={`text-[28px] font-bold tracking-tight ${valueColor}`}>
        {value}
      </span>
      {subtitle && (
        <span className="text-xs font-medium text-text-muted">{subtitle}</span>
      )}
    </div>
  );
}
