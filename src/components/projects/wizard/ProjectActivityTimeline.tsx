import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History, ChevronDown, Plus, Phone, Mail, Users, MessageSquare, Cog, FileText, Send, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TimelineEntry {
  id: string;
  project_id: string;
  event_date: string;
  channel: string;
  title: string;
  description: string | null;
  contact_id: string | null;
  contact_name?: string;
  auto_detected: boolean;
  created_at: string;
}

const CHANNELS = [
  { value: "llamada", label: "Llamada", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "reunion", label: "Reunión", icon: Users },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "interno", label: "Interno", icon: Cog },
  { value: "otro", label: "Otro", icon: FileText },
];

const getChannelConfig = (channel: string) =>
  CHANNELS.find(c => c.value === channel) || CHANNELS[5];

interface Props {
  projectId: string;
}

export const ProjectActivityTimeline = ({ projectId }: Props) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [channel, setChannel] = useState("llamada");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchEntries = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_project_timeline")
        .select("*, people_contacts!business_project_timeline_contact_id_fkey(name)")
        .eq("project_id", projectId)
        .order("event_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setEntries(
        (data || []).map((t: any) => ({
          ...t,
          contact_name: t.people_contacts?.name || null,
        }))
      );
    } catch (e) {
      console.error("Error fetching timeline:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 30000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("business_project_timeline").insert({
        project_id: projectId,
        event_date: eventDate,
        channel,
        title: title.trim(),
        description: description.trim() || null,
        auto_detected: false,
        user_id: user?.id || null,
      });
      if (error) throw error;
      toast.success("Evento añadido al historial");
      setTitle("");
      setDescription("");
      setShowForm(false);
      await fetchEntries();
    } catch (e: any) {
      console.error("Error adding timeline entry:", e);
      toast.error("Error al añadir evento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Historial de actividad</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {entries.length}
              </Badge>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-3">
            {/* Add entry button / form */}
            {!showForm ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed text-xs"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> Registrar actividad
              </Button>
            ) : (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex gap-2">
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map(c => (
                        <SelectItem key={c.value} value={c.value} className="text-xs">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-[140px] h-8 text-xs"
                  />
                </div>
                <Input
                  placeholder="Título del evento..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Textarea
                  placeholder="Descripción (opcional)..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[60px] text-xs resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="text-xs h-7" onClick={handleSubmit} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                    Guardar
                  </Button>
                </div>
              </div>
            )}

            {/* Timeline entries */}
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No hay actividad registrada aún.
              </p>
            ) : (
              <div className="space-y-1">
                {entries.map((entry) => {
                  const ch = getChannelConfig(entry.channel);
                  const Icon = ch.icon;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2.5 py-2 px-2 rounded-md hover:bg-muted/20 transition-colors group"
                    >
                      <div className="mt-0.5 w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-foreground truncate">
                            {entry.title}
                          </span>
                          {entry.auto_detected && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-muted">
                              auto
                            </Badge>
                          )}
                        </div>
                        {entry.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(entry.event_date), "d MMM yyyy", { locale: es })}
                          </span>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {ch.label}
                          </Badge>
                          {entry.contact_name && (
                            <span className="text-[10px] text-muted-foreground">
                              · {entry.contact_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
