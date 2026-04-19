import * as React from "react";
import { cn } from "@/lib/utils";

export interface ContactKpiItem {
  label: string;
  /** Valor principal grande (ej "92", "6d", "54.7k", "S") */
  value: React.ReactNode;
  /** Texto pequeño junto al valor (ej "score · +4", "15 mar 2026", "whatsapp", "inner circle") */
  hint?: React.ReactNode;
  tone?: "primary" | "accent" | "success" | "warning" | "destructive" | "default";
}

interface Props {
  items: ContactKpiItem[];
  className?: string;
}

const TONE: Record<NonNullable<ContactKpiItem["tone"]>, string> = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  default: "text-foreground",
};

/**
 * Strip de KPIs tipo "fichero técnico" — números grandes en font-display
 * con etiqueta micro arriba. Inspirado en el prototipo Holo Neon
 * (SALUD RELACIÓN / ÚLTIMO CONTACTO / MENSAJES TOTALES / TIER).
 */
export function ContactKpiStrip({ items, className }: Props) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        items.length === 2 && "grid-cols-2",
        items.length === 3 && "grid-cols-3",
        items.length >= 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {items.map((it, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl px-4 py-4 sm:px-5 sm:py-5 hover:border-primary/30 transition-colors"
        >
          <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/80 font-mono mb-2.5">
            {it.label}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={cn("font-display text-3xl sm:text-4xl font-semibold leading-none", TONE[it.tone || "default"])}>
              {it.value}
            </span>
            {it.hint && (
              <span className="text-[11px] text-muted-foreground font-mono leading-none">
                {it.hint}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
