import { useState, useEffect, useCallback, useRef } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  History, ChevronDown, Plus, Phone, Mail, Users, MessageSquare, Cog, FileText, Send, Loader2,
  Paperclip, X, Brain, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { extractTextFromFile } from "@/lib/document-text-extract";

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
  analysis_json?: any;
  importance_score?: number;
  attachments?: { id: string; file_name: string; mime_type: string }[];
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

interface PendingFile {
  file: File;
  name: string;
  extractedText: string;
}

interface Props {
  projectId: string;
  onSummaryRefreshNeeded?: () => void;
}

export const ProjectActivityTimeline = ({ projectId, onSummaryRefreshNeeded }: Props) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [channel, setChannel] = useState("llamada");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = async (entryId: string) => {
    try {
      await (supabase as any)
        .from("business_project_timeline_attachments")
        .delete()
        .eq("timeline_id", entryId);

      const { error } = await (supabase as any)
        .from("business_project_timeline")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast.success("Entrada eliminada del historial");
    } catch (e) {
      console.error("Error deleting timeline entry:", e);
      toast.error("Error al eliminar la entrada");
    } finally {
      setDeleteTarget(null);
    }
  };

  const fetchEntries = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("business_project_timeline")
        .select("*, people_contacts!business_project_timeline_contact_id_fkey(name)")
        .eq("project_id", projectId)
        .order("event_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      const entryIds = (data || []).map((t: any) => t.id);
      let attachmentMap: Record<string, any[]> = {};

      if (entryIds.length > 0) {
        const { data: atts } = await (supabase as any)
          .from("business_project_timeline_attachments")
          .select("id, timeline_id, file_name, mime_type")
          .in("timeline_id", entryIds);

        for (const att of (atts || [])) {
          if (!attachmentMap[att.timeline_id]) attachmentMap[att.timeline_id] = [];
          attachmentMap[att.timeline_id].push(att);
        }
      }

      setEntries(
        (data || []).map((t: any) => ({
          ...t,
          contact_name: t.people_contacts?.name || null,
          attachments: attachmentMap[t.id] || [],
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

  // File handling
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setProcessingFiles(true);

    const newFiles: PendingFile[] = [];
    for (const file of selected) {
      let extractedText = "";
      try {
        if (file.type.startsWith("audio/")) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("language", "es");
          const { data, error } = await supabase.functions.invoke("speech-to-text", { body: formData });
          if (!error && data?.text) extractedText = data.text;
        } else {
          const result = await extractTextFromFile(file);
          extractedText = result.text;
        }
      } catch (err) {
        console.warn("Text extraction failed for", file.name, err);
      }
      newFiles.push({ file, name: file.name, extractedText });
    }

    setPendingFiles(prev => [...prev, ...newFiles]);
    setProcessingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      // 1. Insert timeline entry
      const { data: insertedEntry, error } = await (supabase as any)
        .from("business_project_timeline")
        .insert({
          project_id: projectId,
          event_date: eventDate,
          channel,
          title: title.trim(),
          description: description.trim() || null,
          auto_detected: false,
          user_id: user?.id || null,
        })
        .select("id")
        .single();

      if (error) throw error;
      const entryId = insertedEntry.id;

      // 2. Upload and save attachments
      if (pendingFiles.length > 0) {
        for (const pf of pendingFiles) {
          const path = `${projectId}/timeline_attachments/${Date.now()}_${pf.name}`;
          const { error: upErr } = await supabase.storage
            .from("project-documents")
            .upload(path, pf.file);

          if (upErr) {
            console.error("Upload error:", upErr);
            continue;
          }

          await (supabase as any)
            .from("business_project_timeline_attachments")
            .insert({
              timeline_id: entryId,
              project_id: projectId,
              file_name: pf.name,
              storage_path: path,
              mime_type: pf.file.type,
              size_bytes: pf.file.size,
              extracted_text: pf.extractedText || null,
              user_id: user?.id || null,
            });
        }
      }

      toast.success("Evento añadido al historial");
      setTitle("");
      setDescription("");
      setPendingFiles([]);
      setShowForm(false);
      await fetchEntries();

      // 3. Trigger AI analysis in background
      try {
        await supabase.functions.invoke("project-activity-intelligence", {
          body: { action: "analyze_entry", projectId, entryId },
        });
        // After analysis, refresh summary
        await supabase.functions.invoke("project-activity-intelligence", {
          body: { action: "refresh_summary", projectId },
        });
        onSummaryRefreshNeeded?.();
        await fetchEntries();
      } catch (aiErr) {
        console.warn("AI analysis failed (non-blocking):", aiErr);
      }
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

                {/* File attachments */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processingFiles}
                    >
                      {processingFiles ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Paperclip className="w-3 h-3 mr-1" />
                      )}
                      Adjuntar
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.mp3,.m4a,.wav,.webm,.ogg"
                      onChange={handleFilesSelected}
                    />
                    {pendingFiles.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {pendingFiles.length} archivo{pendingFiles.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pendingFiles.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border/50 text-[10px]"
                        >
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          <span className="max-w-[120px] truncate text-foreground">{f.name}</span>
                          {f.extractedText && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0">✓</Badge>
                          )}
                          <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setShowForm(false); setPendingFiles([]); }}>
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
                  const hasAnalysis = !!entry.analysis_json;
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
                          {hasAnalysis && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/30">
                              <Brain className="w-2.5 h-2.5 mr-0.5" />IA
                            </Badge>
                          )}
                          {entry.importance_score && entry.importance_score >= 7 && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">
                              importante
                            </Badge>
                          )}
                        </div>
                        {entry.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {entry.description}
                          </p>
                        )}
                        {/* Analysis summary */}
                        {entry.analysis_json?.summary && (
                          <p className="text-[11px] text-primary/80 mt-0.5 line-clamp-2 italic">
                            {entry.analysis_json.summary}
                          </p>
                        )}
                        {/* Attachments */}
                        {entry.attachments && entry.attachments.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {entry.attachments.length} adjunto{entry.attachments.length > 1 ? "s" : ""}
                            </span>
                            {entry.attachments.slice(0, 3).map((a: any) => (
                              <Badge key={a.id} variant="secondary" className="text-[8px] px-1 py-0 max-w-[80px] truncate">
                                {a.file_name}
                              </Badge>
                            ))}
                          </div>
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
                      <button
                        onClick={() => setDeleteTarget(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                        title="Eliminar entrada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
