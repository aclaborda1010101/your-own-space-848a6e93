import { GlassCard } from "@/components/ui/GlassCard";
import { HealthMeter } from "./HealthMeter";
import { Briefcase, Heart, Users, User, Headphones, Clock, MessageSquarePlus, Sparkles } from "lucide-react";
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
}

/** Devuelve días enteros desde el último contacto (o null si nunca). */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86_400_000);
}

/** Etiqueta cualitativa de la relación según días sin contactar. */
function relationLabel(days: number | null) {
  if (days == null) return { text: "Sin contacto registrado", tone: "muted" as const };
  if (days <= 7) return { text: "Relación activa", tone: "success" as const };
  if (days <= 30) return { text: `${days}d sin contacto`, tone: "default" as const };
  if (days <= 90) return { text: "En riesgo de enfriarse", tone: "warning" as const };
  return { text: "Dormida", tone: "destructive" as const };
}

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  profesional: { icon: Briefcase, label: "Profesional", cls: "bg-primary/15 text-primary border-primary/30" },
  personal: { icon: Heart, label: "Personal", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  familiar: { icon: Users, label: "Familia", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export function ContactCard({ contact, onClick }: ContactCardProps) {
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
  const rel = relationLabel(days);
  const needsFollowUp = days != null && days > 14 && !!contact.last_topic;

  const relToneCls =
    rel.tone === "success"
      ? "bg-success/10 text-success border-success/30"
      : rel.tone === "warning"
      ? "bg-warning/10 text-warning border-warning/30"
      : rel.tone === "destructive"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : rel.tone === "muted"
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

  return (
    <GlassCard
      hover
      className="p-5 cursor-pointer group"
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
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-base font-semibold font-display text-foreground">
            {initials || "?"}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base text-foreground truncate">
            {contact.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium",
                meta.cls,
              )}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>

            {/* Días sin contacto / estado relacional */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium",
                    relToneCls,
                  )}
                >
                  <Clock className="w-3 h-3" />
                  {rel.text}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                <p className="font-medium mb-1">Recencia de contacto</p>
                <p className="text-muted-foreground leading-relaxed">
                  {days == null
                    ? "No tenemos registro de la última interacción."
                    : `Última interacción registrada hace ${days} ${days === 1 ? "día" : "días"}.`}
                </p>
              </TooltipContent>
            </Tooltip>

            {contact.has_podcast && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[11px] text-primary font-medium">
                <Headphones className="w-3 h-3" />
                Podcast
              </span>
            )}
          </div>
        </div>

        {/* Health: anillo + label explicativo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <HealthMeter score={contact.health_score} size="sm" showLabel={false} />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                Salud /10
              </span>
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

      {/* Seguimiento recomendado */}
      {needsFollowUp && (
        <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 text-[11px] font-medium">
            <Sparkles className="w-3 h-3" />
            Seguimiento recomendado
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-primary hover:text-primary"
            onClick={handleDraft}
          >
            <MessageSquarePlus className="w-3 h-3" />
            Redactar mensaje
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
