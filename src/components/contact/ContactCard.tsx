import { GlassCard } from "@/components/ui/GlassCard";
import { HealthMeter } from "./HealthMeter";
import {
  Briefcase,
  Heart,
  Users,
  User,
  Headphones,
  MessageSquarePlus,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ContactCardData {
  id: string;
  name: string;
  category: string | null;
  health_score: number;
  last_topic: string | null;
  has_podcast: boolean;
  /** ISO string del último contacto (opcional para cálculo de días sin contactar) */
  last_contact?: string | null;
}

interface ContactCardProps {
  contact: ContactCardData;
  onClick: () => void;
  /** Si se pasa, muestra una X discreta arriba a la derecha para sacar de la red */
  onRemove?: () => void;
}

/** Devuelve días enteros desde el último contacto (o null si nunca). */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86_400_000);
}

/** Chip compacto de recencia. */
function recencyChip(days: number | null) {
  if (days == null)
    return {
      label: "—",
      tone: "muted" as const,
      tip: "No tenemos registro de la última interacción.",
    };
  if (days <= 7)
    return {
      label: `✓ ${days}d`,
      tone: "success" as const,
      tip: `Relación activa: hace ${days} ${days === 1 ? "día" : "días"}.`,
    };
  if (days <= 30)
    return {
      label: `${days}d`,
      tone: "default" as const,
      tip: `Última interacción hace ${days} días. Mantente al tanto.`,
    };
  if (days <= 90)
    return {
      label: `⚠ ${days}d`,
      tone: "warning" as const,
      tip: `En riesgo de enfriarse: ${days} días sin hablar.`,
    };
  return {
    label: `💤 ${days}d`,
    tone: "destructive" as const,
    tip: `Relación dormida: ${days} días sin contacto.`,
  };
}

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  profesional: { icon: Briefcase, label: "Profesional", cls: "bg-primary/15 text-primary border-primary/30" },
  personal: { icon: Heart, label: "Personal", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  familiar: { icon: Users, label: "Familia", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export function ContactCard({ contact, onClick, onRemove }: ContactCardProps) {
  const navigate = useNavigate();
  const meta = CATEGORY_META[contact.category || ""] || {
    icon: User,
    label: "Otro",
    cls: "bg-muted/20 text-muted-foreground border-muted/30",
  };
  const Icon = meta.icon;
  const initials = contact.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const days = daysSince(contact.last_contact);
  const rec = recencyChip(days);
  const needsFollowUp = days != null && days > 14 && !!contact.last_topic;

  const recToneCls =
    rec.tone === "success"
      ? "bg-success/10 text-success border-success/30"
      : rec.tone === "warning"
      ? "bg-warning/10 text-warning border-warning/30"
      : rec.tone === "destructive"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : rec.tone === "muted"
      ? "bg-muted/20 text-muted-foreground border-muted/30"
      : "bg-card/50 text-foreground/80 border-border/60";

  const handleDraft = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ctx = encodeURIComponent(
      `Redacta un mensaje breve y natural para reconectar con ${contact.name}` +
        (days != null ? ` (llevo ${days} días sin hablar)` : "") +
        (contact.last_topic ? `. Último tema pendiente: "${contact.last_topic}"` : "") +
        ". Tono cálido, directo, sin venderse."
    );
    navigate(`/chat?contact=${contact.id}&prompt=${ctx}`);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <GlassCard
      hover
      className="p-4 cursor-pointer group relative"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {onRemove && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Quitar de la red"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Quitar de la red estratégica
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold font-display text-foreground">
            {initials || "?"}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base text-foreground truncate pr-6">
            {contact.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap",
                meta.cls,
              )}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap font-mono",
                    recToneCls,
                  )}
                >
                  {rec.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                <p className="font-medium mb-1">Recencia de contacto</p>
                <p className="text-muted-foreground leading-relaxed">{rec.tip}</p>
              </TooltipContent>
            </Tooltip>

            {contact.has_podcast && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[10px] text-primary">
                    <Headphones className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Tiene podcast generado
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Health: anillo compacto sin label inferior */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="shrink-0 w-12 flex items-center justify-center">
              <HealthMeter score={contact.health_score} size="sm" showLabel={false} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px] text-xs">
            <p className="font-medium mb-1">Salud relacional: {contact.health_score}/10</p>
            <p className="text-muted-foreground leading-relaxed">
              Calculada con frecuencia de contacto, recencia, sentimiento de las conversaciones e historial de interacciones.
              <br />
              <span className="text-destructive">0–3</span> crítica · <span className="text-warning">4–6</span> atención · <span className="text-success">7–10</span> sana
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {contact.last_topic && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {contact.last_topic}
        </p>
      )}

      {needsFollowUp && (
        <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 text-[10px] font-medium">
            <Sparkles className="w-3 h-3" />
            Seguimiento
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-primary hover:text-primary px-2"
            onClick={handleDraft}
          >
            <MessageSquarePlus className="w-3 h-3" />
            Redactar
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
