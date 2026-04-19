import { cn } from "@/lib/utils";

interface HealthMeterProps {
  score: number; // 0-10
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

/**
 * Anillo circular 0-10 con gradiente rojo→ámbar→verde.
 */
export function HealthMeter({
  score,
  size = "md",
  showLabel = true,
  label,
  className,
}: HealthMeterProps) {
  const clamped = Math.max(0, Math.min(10, score));
  const pct = clamped / 10;

  const dimensions = {
    sm: { box: 44, stroke: 4, font: "text-xs" },
    md: { box: 64, stroke: 5, font: "text-base" },
    lg: { box: 96, stroke: 7, font: "text-2xl" },
  }[size];

  const radius = (dimensions.box - dimensions.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  // Color hue: 0 (red) → 120 (green)
  const hue = Math.round(pct * 120);
  const stroke = `hsl(${hue}, 75%, 55%)`;

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-1", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={clamped}
      aria-label={label || `Salud ${clamped} de 10`}
    >
      <div className="relative" style={{ width: dimensions.box, height: dimensions.box }}>
        <svg width={dimensions.box} height={dimensions.box} className="-rotate-90">
          <circle
            cx={dimensions.box / 2}
            cy={dimensions.box / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted) / 0.3)"
            strokeWidth={dimensions.stroke}
          />
          <circle
            cx={dimensions.box / 2}
            cy={dimensions.box / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-mono font-semibold", dimensions.font)}>
            {clamped}
          </span>
        </div>
      </div>
      {showLabel && label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
