import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface HeadlineCardProps {
  label: string;
  value: React.ReactNode;
  line2?: React.ReactNode;
  line3?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "primary" | "warning" | "success";
  className?: string;
}

export function HeadlineCard({
  label,
  value,
  line2,
  line3,
  icon,
  accent = "primary",
  className,
}: HeadlineCardProps) {
  const accentColor = {
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
  }[accent];

  return (
    <GlassCard className={cn("p-6 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        {icon && <span className={cn("opacity-70", accentColor)}>{icon}</span>}
      </div>
      <div className="text-2xl font-semibold leading-tight font-display">
        {value}
      </div>
      {line2 && (
        <div className="text-sm text-foreground/80">{line2}</div>
      )}
      {line3 && (
        <div className="text-xs text-muted-foreground">{line3}</div>
      )}
    </GlassCard>
  );
}
