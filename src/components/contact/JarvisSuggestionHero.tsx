import * as React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface JarvisSuggestionHeroProps {
  /** Titular grande con palabra(s) destacable(s) en color */
  headline: React.ReactNode;
  /** Subtítulo / pretexto detectado */
  pretext?: React.ReactNode;
  /** Línea adicional de contexto */
  context?: React.ReactNode;
  /** Score 0-100 que muestra el ring */
  confidence?: number;
  /** Etiqueta de prioridad */
  priority?: "alta" | "media" | "baja";
  /** Tiempo desde detección, ej "12 min" */
  detectedAgo?: string;
  /** Tags/badges debajo del ring */
  tags?: string[];
  /** Acción primaria */
  onAccept?: () => void;
  acceptLabel?: string;
  /** Acción secundaria */
  onEvidence?: () => void;
  evidenceLabel?: string;
  /** Acción terciaria (descartar) */
  onDismiss?: () => void;
}

/**
 * Bloque hero "JARVIS SUGIERE" — el bloque protagonista de la ficha.
 * Inspirado en el prototipo Holo Neon: titular grande, palabra clave en
 * color, ring de confianza a la derecha, acciones grandes.
 */
export function JarvisSuggestionHero({
  headline,
  pretext,
  context,
  confidence = 87,
  priority = "alta",
  detectedAgo,
  tags = [],
  onAccept,
  acceptLabel = "Aceptar y agendar",
  onEvidence,
  evidenceLabel = "Ver evidencia",
  onDismiss,
}: JarvisSuggestionHeroProps) {
  const ringColor =
    confidence >= 80 ? "hsl(var(--success))" :
    confidence >= 60 ? "hsl(var(--primary))" :
    "hsl(var(--warning))";

  const priorityCls = {
    alta: "text-warning border-warning/40 bg-warning/10",
    media: "text-primary border-primary/40 bg-primary/10",
    baja: "text-muted-foreground border-border bg-card/40",
  }[priority];

  // SVG ring math
  const size = 140;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (confidence / 100) * circumference;

  return (
    <GlassCard className="relative overflow-hidden p-6 sm:p-8 border-success/20 shadow-[0_0_60px_-20px_hsl(var(--success)/0.4)]">
      {/* Ambient glow interno */}
      <div className="absolute inset-0 bg-gradient-to-br from-success/[0.06] via-transparent to-primary/[0.04] pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-[280px] h-[280px] bg-success/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Columna izquierda: contenido */}
        <div className="flex-1 min-w-0">
          {/* Eyebrow */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-success font-mono font-semibold">
                Jarvis sugiere
              </span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span className={cn("text-[10px] uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border font-mono", priorityCls)}>
              Prioridad {priority}
            </span>
          </div>

          {/* Titular */}
          <h2 className="font-display font-semibold text-2xl sm:text-3xl lg:text-[2.2rem] leading-[1.15] tracking-tight mb-4">
            {headline}
          </h2>

          {/* Pretexto */}
          {pretext && (
            <p className="text-sm sm:text-base text-foreground/80 leading-relaxed mb-2">
              <span className="text-primary font-medium">Pretexto detectado:</span> {pretext}
            </p>
          )}
          {context && (
            <p className="text-sm sm:text-base text-foreground/70 leading-relaxed mb-5">
              {context}
            </p>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 mt-6">
            {onAccept && (
              <Button
                onClick={onAccept}
                className="rounded-full bg-success text-success-foreground hover:bg-success/90 shadow-[0_0_24px_-6px_hsl(var(--success)/0.6)]"
              >
                {acceptLabel}
              </Button>
            )}
            {onEvidence && (
              <Button
                onClick={onEvidence}
                variant="outline"
                className="rounded-full border-border/60 hover:border-primary/40 hover:text-primary"
              >
                {evidenceLabel}
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
            {onDismiss && (
              <Button
                onClick={onDismiss}
                variant="ghost"
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                Descartar
              </Button>
            )}
          </div>
        </div>

        {/* Columna derecha: ring + meta */}
        <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 shrink-0">
          {detectedAgo && (
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground px-3 py-1.5 rounded-full border border-border/60 bg-card/40 backdrop-blur-md">
              <Clock className="w-3 h-3" />
              hace {detectedAgo}
            </div>
          )}

          {/* Ring SVG */}
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="hsl(var(--border))"
                strokeOpacity={0.3}
                strokeWidth={stroke}
                fill="none"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={ringColor}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{
                  filter: `drop-shadow(0 0 8px ${ringColor})`,
                  transition: "stroke-dashoffset 0.8s ease-out",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-3xl font-semibold leading-none" style={{ color: ringColor }}>
                {confidence}
              </div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono mt-1">
                Confianza
              </div>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 lg:justify-end max-w-[180px]">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-[0.15em] font-mono px-2 py-1 rounded-full border border-success/30 bg-success/10 text-success"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
