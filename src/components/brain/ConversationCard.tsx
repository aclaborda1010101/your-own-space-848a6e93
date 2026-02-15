import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, X, UserPlus, Pencil, Check } from "lucide-react";
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

export function ConversationCard({ group, dbBrain }: ConversationCardProps) {
  const { main, segments } = group;
  const [expanded, setExpanded] = useState(false);
  const [editingPeople, setEditingPeople] = useState(false);
  const [newPerson, setNewPerson] = useState("");
  const queryClient = useQueryClient();

  const title = main.metadata?.title || "Conversación";
  const hasSegments = segments.length > 1;

  // Collect all unique people across segments
  const allPeople = Array.from(
    new Set(segments.flatMap(s => s.people || []))
  );

  const formatDate = (d: string) => {
    try { return format(new Date(d), "d MMM yyyy", { locale: es }); }
    catch { return d; }
  };

  const removePerson = async (personName: string) => {
    try {
      // Remove from all segments of this conversation
      for (const seg of segments) {
        if (!seg.people?.includes(personName)) continue;
        const newPeople = seg.people.filter(p => p !== personName);
        await supabase
          .from("conversation_embeddings")
          .update({ people: newPeople })
          .eq("id", seg.id);
      }
      toast.success(`"${personName}" eliminado de la conversación`);
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
      // Add to all segments of this conversation
      for (const seg of segments) {
        const current = seg.people || [];
        if (current.includes(name)) continue;
        await supabase
          .from("conversation_embeddings")
          .update({ people: [...current, name] })
          .eq("id", seg.id);
      }
      setNewPerson("");
      toast.success(`"${name}" añadido a la conversación`);
      queryClient.invalidateQueries({ queryKey: ["brain-conversations", dbBrain] });
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    } catch {
      toast.error("Error al añadir contacto");
    }
  };

  return (
    <div className="p-3 hover:bg-muted/30 transition-colors">
      {/* Main header - clickable to expand */}
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-1">{title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{main.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasSegments && (
            <Badge variant="secondary" className="text-[10px]">
              {segments.length} temas
            </Badge>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(main.date)}</span>
          {(hasSegments || allPeople.length > 0) && (
            expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* People badges (always visible) */}
      {allPeople.length > 0 && !expanded && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {allPeople.map(p => (
            <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* People section with edit */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Participantes</span>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingPeople(!editingPeople); }}
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Editar participantes"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {allPeople.map(p => (
                <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  {p}
                  {editingPeople && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removePerson(p); }}
                      className="hover:text-destructive transition-colors"
                      title={`Eliminar ${p}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
              {allPeople.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Sin participantes</span>
              )}
            </div>
            {editingPeople && (
              <div className="flex gap-1.5 mt-1">
                <Input
                  value={newPerson}
                  onChange={e => setNewPerson(e.target.value)}
                  placeholder="Añadir persona..."
                  className="h-7 text-xs"
                  onKeyDown={e => e.key === "Enter" && addPerson()}
                  onClick={e => e.stopPropagation()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={(e) => { e.stopPropagation(); addPerson(); }}
                  disabled={!newPerson.trim()}
                >
                  <UserPlus className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Sub-segments */}
          {hasSegments && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Temas tratados</span>
              <div className="space-y-1 pl-2 border-l-2 border-primary/20">
                {segments.map((seg, i) => {
                  const segTitle = seg.metadata?.title;
                  return (
                    <div key={seg.id} className="py-1.5">
                      {segTitle && segTitle !== title && (
                        <p className="text-xs font-medium text-foreground">{segTitle}</p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2">{seg.summary}</p>
                      {seg.people && seg.people.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {seg.people.map(p => (
                            <Badge key={p} variant="outline" className="text-[9px] px-1 py-0">{p}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
