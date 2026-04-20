import { GlassCard } from "@/components/ui/GlassCard";
import {
  Briefcase,
  Heart,
  Users,
  User,
  Headphones,
  MessageSquarePlus,
  Sparkles,
  X,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { HealthMetricRing } from "@/components/health/HealthMetricRing";

interface ContactCardData {
  id: string;
  name: string;
  category: string | null;
  health_score: number;
  last_topic: string | null;
  has_podcast: boolean;
  /** ISO string del último contacto */
  last_contact?: string | null;
  /** Nº de mensajes WhatsApp acumulados */
  wa_message_count?: number | null;
}

interface ContactCardProps {
  contact: ContactCardData;
  onClick: () => void;
  onRemove?: () => void;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86_400_000);
}

function recencyLabel(days: number | null): { text: string; tone: "success" | "default" | "warning" | "destructive" | "muted"; tip: string } {
  if (days == null) return { text: "Sin registro", tone: "muted", tip: "No tenemos registro de la última interacción." };
  if (days === 0) return { text: "Hoy", tone: "success", tip: "Hablasteis hoy." };
  if (days <= 7) return { text: `Hace ${days}d`, tone: "success", tip: `Relación activa: hace ${days} ${days === 1 ? "día" : "días"}.` };
  if (days <= 30) return { text: `Hace ${days}d`, tone: "default", tip: `Última interacción hace ${days} días.` };
  if (days <= 90) return { text: `Hace ${days}d`, tone: "warning", tip: `En riesgo de enfriarse: ${days} días sin hablar.` };
  return { text: `Hace ${days}d`, tone: "destructive", tip: `Relación dormida: ${days} días sin contacto.` };
}

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  profesional: { icon: Briefcase, label: "Profesional", cls: "bg-primary/15 text-primary border-primary/30" },
  personal: { icon: Heart, label: "Personal", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  familiar: { icon: Users, label: "Familia", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

/** Devuelve tono semántico según rango del score (mismo lenguaje que los KPIs). */
function scoreTone(score: number): {
  ringTone: "success" | "warning" | "destructive";
  border: string;
  label: string;
} {
  if (score >= 7) return { ringTone: "success", border: "hover:border-success/40", label: "Sana" };
  if (score >= 4) return { ringTone: "warning", border: "hover:border-warning/40", label: "Atención" };
  return { ringTone: "destructive", border: "hover:border-destructive/40", label: "Crítica" };
}

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
  const rec = recencyLabel(days);
  const needsFollowUp = days != null && days > 14 && !!contact.last_topic;
  const tone = scoreTone(contact.health_score);
  const score = Math.round(contact.health_score);
  const msgs = contact.wa_message_count || 0;

  const recDotCls =
    rec.tone === "success" ? "bg-success" :
    rec.tone === "warning" ? "bg-warning" :
    rec.tone === "destructive" ? "bg-destructive" :
    rec.tone === "muted" ? "bg-muted-foreground/40" :
    "bg-foreground/40";

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
      className={cn(
        "p-5 cursor-pointer group relative border transition-all duration-200",
        tone.border,
      )}
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

      {/* Cabecera: avatar + nombre/categoría + score grande */}
      <div className="flex items-start gap-4">
        {/* Avatar grande */}
        <div className="shrink-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center text-base font-semibold font-display text-foreground">
            {initials || "?"}
          </div>
        </div>

        {/* Nombre + chip categoría */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-display font-semibold text-base text-foreground truncate pr-8 leading-tight">
            {contact.name}
          </h3>
          <div className="mt-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap",
                meta.cls,
              )}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>
          </div>
        </div>

        {/* Anillo de salud con gradient + glow (mismo lenguaje que el detalle) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="shrink-0">
              <HealthMetricRing
                percent={score * 10}
                value={String(score)}
                label=""
                tone={tone.ringTone}
                size="sm"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px] text-xs">
            <p className="font-medium mb-1">Salud relacional: {score}/10 · {tone.label}</p>
            <p className="text-muted-foreground leading-relaxed">
              Calculada con frecuencia de contacto, recencia, sentimiento de conversaciones e historial.
              <br />
              <span className="text-destructive">0–3</span> crítica · <span className="text-warning">4–6</span> atención · <span className="text-success">7–10</span> sana
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Meta-fila: recencia + mensajes + podcast */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", recDotCls)} />
              <span className="font-mono">{rec.text}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[220px]">
            {rec.tip}
          </TooltipContent>
        </Tooltip>

        {msgs > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            <span className="font-mono">{msgs > 999 ? `${(msgs / 1000).toFixed(1)}k` : msgs}</span>
          </span>
        )}

        {contact.has_podcast && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-primary">
                <Headphones className="w-3 h-3" />
                <span>Podcast</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Tiene podcast generado
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Contexto / último tema */}
      {contact.last_topic && (
        <p className="mt-3 text-xs text-muted-foreground/90 italic line-clamp-2 leading-relaxed">
          “{contact.last_topic}”
        </p>
      )}

      {/* Acciones de seguimiento */}
      {needsFollowUp && (
        <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-border/40">
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
