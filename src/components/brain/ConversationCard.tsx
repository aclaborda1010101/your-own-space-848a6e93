import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, X, Plus, Trash2,
  Phone, Utensils, Video, Briefcase, MessageCircle,
  RefreshCw, Loader2
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

function getConversationIcon(title: string) {
  const t = (title || "").toLowerCase();
  if (/llamada|teléfono|telefono|phone|call/.test(t)) return Phone;
  if (/comida|cena|almuerzo|restaurante|lunch|dinner/.test(t)) return Utensils;
  if (/video|zoom|meet|teams/.test(t)) return Video;
  if (/reunión|reunion|meeting|junta/.test(t)) return Briefcase;
  return MessageCircle;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-600",
  "bg-emerald-500/20 text-emerald-600",
  "bg-amber-500/20 text-amber-600",
  "bg-rose-500/20 text-rose-600",
  "bg-violet-500/20 text-violet-600",
  "bg-cyan-500/20 text-cyan-600",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ConversationCard({ group, dbBrain }: ConversationCardProps) {
  const { main, segments } = group;
  const [expanded, setExpanded] = useState(false);
  const [newPerson, setNewPerson] = useState("");
  const [reprocessing, setReprocessing] = useState(false);
  const queryClient = useQueryClient();

  const title = main.metadata?.title || main.summary?.substring(0, 60) || "Conversación";
  const transcriptionId = main.transcription_id;

  const dateLabel = (() => {
    try {
      return format(new Date(main.date), "d 'de' MMMM yyyy", { locale: es });
    } catch {
      return main.date;
    }
  })();

  const summary = main.summary || "";

  const allPeople = Array.from(
    new Set(segments.flatMap(s => s.people || []))
  );

  const ConvIcon = getConversationIcon(title);

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

  const reprocessTranscription = async () => {
    if (!transcriptionId) {
      toast.error("No hay transcripción asociada para reprocesar");
      return;
    }
    setReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-transcription", {
        body: { reprocess_transcription_id: transcriptionId },
      });
      if (error) throw error;
      toast.success("Transcripción reprocesada correctamente");
      queryClient.invalidateQueries({ queryKey: ["brain-conversations", dbBrain] });
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    } catch (err: any) {
      toast.error(`Error al reprocesar: ${err.message || "desconocido"}`);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="p-5 hover:bg-muted/30 transition-colors rounded-lg">
      {/* Header */}
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
          <ConvIcon className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{dateLabel}</p>
          {allPeople.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {allPeople.slice(0, 4).map(p => (
                <div
                  key={p}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(p)}`}
                  title={p}
                >
                  {getInitials(p)}
                </div>
              ))}
              {allPeople.length > 4 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">+{allPeople.length - 4}</span>
              )}
              <span className="text-xs text-muted-foreground ml-1">
                {allPeople.slice(0, 3).join(", ")}{allPeople.length > 3 ? "..." : ""}
              </span>
            </div>
          )}
          {allPeople.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 italic mt-1.5">Sin interlocutores identificados</p>
          )}
          {!expanded && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-2.5 leading-relaxed">{summary}</p>
          )}
        </div>

        <div className="shrink-0 mt-1">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 ml-12 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Interlocutores</span>
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
                <span className="text-xs text-muted-foreground italic">Sin interlocutores</span>
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

          {/* Actions: Reprocess + Delete */}
          <div className="pt-2 border-t border-border flex items-center gap-2">
            {transcriptionId && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={(e) => { e.stopPropagation(); reprocessTranscription(); }}
                disabled={reprocessing}
              >
                {reprocessing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />
                }
                {reprocessing ? "Reprocesando..." : "Reprocesar"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={(e) => { e.stopPropagation(); deleteConversation(); }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
