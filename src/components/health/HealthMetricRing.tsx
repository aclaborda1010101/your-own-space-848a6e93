import { cn } from "@/lib/utils";

interface HealthMetricRingProps {
  /** 0–100 % de relleno del anillo */
  percent: number | null;
  /** Texto principal en el centro (ej. "85%", "7:30", "12.4") */
  value: string;
  /** Etiqueta debajo */
  label: string;
  /** Tono semántico — controla color del gradient */
  tone?: "primary" | "success" | "warning" | "destructive" | "accent";
  size?: "sm" | "md" | "lg";
  /** Subtexto pequeño bajo el valor (ej. "horas", "/ 21") */
  hint?: string;
  className?: string;
}

const toneToGradient: Record<NonNullable<HealthMetricRingProps["tone"]>, { from: string; to: string; glow: string }> = {
  primary: { from: "hsl(var(--primary))", to: "hsl(var(--primary) / 0.4)", glow: "hsl(var(--primary) / 0.55)" },
  success: { from: "hsl(var(--success))", to: "hsl(var(--success) / 0.4)", glow: "hsl(var(--success) / 0.55)" },
  warning: { from: "hsl(var(--warning))", to: "hsl(var(--warning) / 0.4)", glow: "hsl(var(--warning) / 0.55)" },
  destructive: { from: "hsl(var(--destructive))", to: "hsl(var(--destructive) / 0.4)", glow: "hsl(var(--destructive) / 0.55)" },
  accent: { from: "hsl(var(--accent))", to: "hsl(var(--accent) / 0.4)", glow: "hsl(var(--accent) / 0.55)" },
};

const sizeMap = {
  sm: { box: 88, stroke: 7, value: "text-base", hint: "text-[9px]" },
  md: { box: 120, stroke: 9, value: "text-2xl", hint: "text-[10px]" },
  lg: { box: 160, stroke: 11, value: "text-4xl", hint: "text-xs" },
};

/**
 * Anillo SVG con gradient + glow neon. Reemplaza los círculos planos.
 * Look futurista / IA, totalmente reactivo al tono semántico.
 */
export function HealthMetricRing({
  percent,
  value,
  label,
  tone = "primary",
  size = "md",
  hint,
  className,
}: HealthMetricRingProps) {
  const dims = sizeMap[size];
  const safePct = Math.max(0, Math.min(100, percent ?? 0));
  const radius = (dims.box - dims.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safePct / 100);
  const gradient = toneToGradient[tone];
  const gradId = `ring-grad-${tone}-${size}`;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: dims.box, height: dims.box }}>
        {/* Glow exterior */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-40"
          style={{ background: `radial-gradient(circle, ${gradient.glow} 0%, transparent 65%)` }}
          aria-hidden
        />
        <svg width={dims.box} height={dims.box} className="-rotate-90 relative">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={dims.box / 2}
            cy={dims.box / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted) / 0.18)"
            strokeWidth={dims.stroke}
          />
          {/* Progress */}
          <circle
            cx={dims.box / 2}
            cy={dims.box / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={dims.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)",
              filter: `drop-shadow(0 0 6px ${gradient.glow})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums tracking-tight text-foreground", dims.value)}>
            {value}
          </span>
          {hint && (
            <span className={cn("text-muted-foreground uppercase tracking-wider mt-0.5", dims.hint)}>
              {hint}
            </span>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] font-medium">
        {label}
      </p>
    </div>
  );
}
