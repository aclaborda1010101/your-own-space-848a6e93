import { GlassCard } from "@/components/ui/GlassCard";
import { HealthMeter } from "./HealthMeter";
import { Briefcase, Heart, Users, User, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ContactCardData {
  id: string;
  name: string;
  category: string | null;
  health_score: number;
  last_topic: string | null;
  has_podcast: boolean;
}

interface ContactCardProps {
  contact: ContactCardData;
  onClick: () => void;
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
            {contact.has_podcast && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[11px] text-primary font-medium">
                <Headphones className="w-3 h-3" />
                Podcast
              </span>
            )}
          </div>
        </div>

        {/* Health */}
        <HealthMeter score={contact.health_score} size="sm" showLabel={false} />
      </div>

      {contact.last_topic && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {contact.last_topic}
        </p>
      )}
    </GlassCard>
  );
}
