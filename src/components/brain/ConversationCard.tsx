import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, X, Plus, Trash2,
  Phone, Utensils, Video, Briefcase, MessageCircle, Users
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ConversationSegment {
  id: string;
  date: string;
  brain: string | null;
  summary: string;
  people: string[] | null;
  transcription_id: string | null;
  metadata: any;
}

interface ConversationGroup {
  main: ConversationSegment;
  segments: ConversationSegment[];
}

interface ConversationCardProps {
  group: ConversationGroup;
  dbBrain: string;
}

function getSegmentIcon(title: string) {
  const t = (title || "").toLowerCase();
  if (/llamada|teléfono|telefono|phone|call/.test(t)) return Phone;
  if (/comida|cena|almuerzo|restaurante|lunch|dinner/.test(t)) return Utensils;
  if (/video|zoom|meet|teams/.test(t)) return Video;
  if (/reunión|reunion|meeting|junta/.test(t)) return Briefcase;
  return MessageCircle;
}

export function ConversationCard({ group, dbBrain }: ConversationCardProps) {
  const { main, segments } = group;
  const [expanded, setExpanded] = useState(false);
  const [newPerson, setNewPerson] = useState("");
  const queryClient = useQueryClient();

  // Title = formatted date instead of metadata title
  const dateTitle = (() => {
    try {
      const d = new Date(main.date);
      return `Día ${format(d, "d 'de' MMMM yyyy", { locale: es })}`;
    } catch {
      return main.date;
    }
  })();

  const hasSegments = segments.length > 1;

  const allPeople = Array.from(
    new Set(segments.flatMap(s => s.people || []))
  );

  const removePerson = async (personName: string) => {
    try {
      for (const seg of segments) {
        if (!seg.people?.includes(personName)) continue;
        const newPeople = seg.people.filter(p => p !== personName);
        await supabase
          .from("conversation_embeddings")
          .update({ people: newPeople })
          .eq("id", seg.id);
      }
      toast.success(`"${personName}" eliminado`);
      queryClient.invalidateQueries({ queryKey: ["brain-conversations", dbBrain] });
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    } catch {
      toast.error("Error al eliminar contacto");
    }
  };

  const addPerson = async () => {
    const name = newPerson.trim();
    if (!name) return;
    try {
      for (const seg of segments) {
        const current = seg.people || [];
        if (current.includes(name)) continue;
        await supabase
          .from("conversation_embeddings")
          .update({ people: [...current, name] })
          .eq("id", seg.id);
      }
      setNewPerson("");
      toast.success(`"${name}" añadido`);
      queryClient.invalidateQueries({ queryKey: ["brain-conversations", dbBrain] });
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    } catch {
      toast.error("Error al añadir contacto");
    }
  };

  const deleteConversation = async () => {
    if (!confirm("¿Eliminar esta conversación y todos sus segmentos?")) return;
    try {
      for (const seg of segments) {
        await supabase.from("conversation_embeddings").delete().eq("id", seg.id);
      }
      toast.success("Conversación eliminada");
      queryClient.invalidateQueries({ queryKey: ["brain-conversations", dbBrain] });
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors rounded-lg">
      {/* Header - Date as main title */}
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{dateTitle}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{main.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasSegments && (
            <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
              {segments.length} temas
            </Badge>
          )}
          {allPeople.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />{allPeople.length}
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* People badges - collapsed view */}
      {allPeople.length > 0 && !expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {allPeople.slice(0, 5).map(p => (
            <Badge key={p} variant="outline" className="text-[11px] px-2 py-0.5">{p}</Badge>
          ))}
          {allPeople.length > 5 && (
            <Badge variant="secondary" className="text-[11px] px-2 py-0.5">+{allPeople.length - 5}</Badge>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Sub-segments with individual icons and titles */}
          {hasSegments && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Temas tratados</span>
              <div className="space-y-1 pl-1">
                {segments.map((seg) => {
                  const segTitle = seg.metadata?.title || "Conversación";
                  const SegIcon = getSegmentIcon(segTitle);
                  const segPeople = seg.people || [];
                  return (
                    <div key={seg.id} className="py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                          <SegIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{segTitle}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{seg.summary}</p>
                          {segPeople.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {segPeople.map(p => (
                                <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single segment - show full summary */}
          {!hasSegments && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{main.summary}</p>
            </div>
          )}

          {/* Participants with direct remove */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Participantes</span>
            <div className="flex flex-wrap gap-2">
              {allPeople.map(p => (
                <Badge key={p} variant="outline" className="text-xs px-2.5 py-1 gap-1.5 pr-1">
                  {p}
                  <button
                    onClick={(e) => { e.stopPropagation(); removePerson(p); }}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                    title={`Eliminar ${p}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {allPeople.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Sin participantes</span>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <Input
                value={newPerson}
                onChange={e => setNewPerson(e.target.value)}
                placeholder="Añadir persona..."
                className="h-8 text-xs flex-1"
                onKeyDown={e => e.key === "Enter" && addPerson()}
                onClick={e => e.stopPropagation()}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 gap-1.5 text-xs"
                onClick={(e) => { e.stopPropagation(); addPerson(); }}
                disabled={!newPerson.trim()}
              >
                <Plus className="w-3 h-3" /> Añadir
              </Button>
            </div>
          </div>

          {/* Delete conversation */}
          <div className="pt-2 border-t border-border">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={(e) => { e.stopPropagation(); deleteConversation(); }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar conversación
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
