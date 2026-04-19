import * as React from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

export interface HeroStat {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "primary" | "accent" | "warning" | "success" | "destructive";
  icon?: React.ReactNode;
}

interface PageHeroProps {
  /** Pequeña etiqueta superior tipo "INTELIGENCIA RELACIONAL" */
  eyebrow?: React.ReactNode;
  eyebrowIcon?: React.ReactNode;
  /** Título principal — admite JSX para mezclar serif/italic/color */
  title: React.ReactNode;
  /** Frase corta de soporte */
  subtitle?: React.ReactNode;
  /** Botones de acción a la derecha */
  actions?: React.ReactNode;
  /** Tarjetas KPI debajo del título */
  stats?: HeroStat[];
  /** Contenido libre extra debajo (gráficos, gauges, etc.) */
  children?: React.ReactNode;
  className?: string;
  /** Color del glow ambiental */
  tone?: "primary" | "accent" | "warning" | "success";
}

const TONE_GLOW = {
  primary: "from-primary/15 via-primary/5",
  accent: "from-accent/15 via-accent/5",
  warning: "from-warning/15 via-warning/5",
  success: "from-success/15 via-success/5",
};

const STAT_TONE: Record<NonNullable<HeroStat["tone"]>, string> = {
  primary: "text-primary border-primary/30 shadow-[0_0_28px_-10px_hsl(var(--primary)/0.55)]",
  accent: "text-accent border-accent/30 shadow-[0_0_28px_-10px_hsl(var(--accent)/0.55)]",
  warning: "text-warning border-warning/30 shadow-[0_0_28px_-10px_hsl(var(--warning)/0.55)]",
  success: "text-success border-success/30 shadow-[0_0_28px_-10px_hsl(var(--success)/0.55)]",
  destructive: "text-destructive border-destructive/30 shadow-[0_0_28px_-10px_hsl(var(--destructive)/0.55)]",
};

/**
 * PageHero — encabezado glassmorphism translúcido reutilizable.
 *
 * Estética unificada Holo Neon: glow ambiental + cristal + tipografía
 * mixta (eyebrow mono + título serif/display + subtítulo).
 */
export function PageHero({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  actions,
  stats,
  children,
  className,
  tone = "primary",
}: PageHeroProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Ambient glow */}
      <div className="absolute inset-x-0 -top-8 h-[360px] pointer-events-none overflow-hidden -z-0">
        <div
          className={cn(
            "absolute -top-32 left-1/4 w-[640px] h-[480px] blur-[120px] rounded-full opacity-70 bg-gradient-radial",
            TONE_GLOW[tone],
            "to-transparent",
          )}
        />
        <div className="absolute top-10 right-10 w-[360px] h-[360px] bg-accent/10 blur-[100px] rounded-full opacity-50" />
      </div>

      <GlassCard className="relative p-6 sm:p-8 overflow-hidden">
        {/* Soft inner gradient sheen */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.04] pointer-events-none" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10">
            <div className="flex-1 min-w-0">
              {eyebrow && (
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-3">
                  {eyebrowIcon}
                  <span>{eyebrow}</span>
                </div>
              )}
              <h1 className="font-display font-semibold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.05]">
                {title}
              </h1>
              {subtitle && (
                <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-2xl">
                  {subtitle}
                </p>
              )}
            </div>

            {actions && (
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {actions}
              </div>
            )}
          </div>

          {stats && stats.length > 0 && (
            <div
              className={cn(
                "grid gap-3 sm:gap-4 mt-6 sm:mt-8",
                stats.length === 2 && "grid-cols-2",
                stats.length === 3 && "grid-cols-2 sm:grid-cols-3",
                stats.length >= 4 && "grid-cols-2 lg:grid-cols-4",
              )}
            >
              {stats.map((s, i) => {
                const toneCls = STAT_TONE[s.tone || "primary"];
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border bg-card/40 backdrop-blur-xl px-4 py-3.5",
                      toneCls,
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                        {s.label}
                      </span>
                      {s.icon && <span className="opacity-80">{s.icon}</span>}
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-semibold leading-none">
                      {s.value}
                    </div>
                    {s.hint && (
                      <div className="text-[11px] text-muted-foreground mt-1.5 truncate">
                        {s.hint}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {children && <div className="mt-6">{children}</div>}
        </div>
      </GlassCard>
    </div>
  );
}
