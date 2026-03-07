import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Plus, Trash2, FileText, Lightbulb, Users, Eye, Target, ChevronDown, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/document-text-extract";

interface DiscoveryItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content_text: string | null;
  source: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "need", label: "Necesidad", icon: Target, color: "text-primary" },
  { value: "competitor", label: "Competencia", icon: Eye, color: "text-orange-500" },
  { value: "research", label: "Investigación", icon: Search, color: "text-blue-500" },
  { value: "client_feedback", label: "Feedback cliente", icon: Users, color: "text-green-500" },
  { value: "opportunity", label: "Oportunidad", icon: Lightbulb, color: "text-yellow-500" },
  { value: "document", label: "Documento", icon: FileText, color: "text-muted-foreground" },
];

interface Props {
  projectId: string;
}

export const ProjectDiscoveryPanel = ({ projectId }: Props) => {
  const { session } = useAuth();
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  // New item form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("need");
  const [contentText, setContentText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    const { data } = await supabase
      .from("business_project_discovery")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, [projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Extract text
      let text = "";
      if (file.type.startsWith("audio/")) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", "es");
        const { data, error } = await supabase.functions.invoke("speech-to-text", { body: formData });
        if (!error && data?.text) text = data.text;
      } else {
        const result = await extractTextFromFile(file);
        text = result.text;
      }

      // Upload file
      const path = `${projectId}/discovery/${Date.now()}_${file.name}`;
      await supabase.storage.from("project-documents").upload(path, file);

      setContentText(text);
      setTitle(title || file.name.replace(/\.[^.]+$/, ""));
      toast.success(`Archivo procesado: ${file.name}`);

      // Auto-set category
      if (!title) setCategory("document");

      // Save reference for later
      (fileRef.current as any).__uploadedPath = path;
      (fileRef.current as any).__uploadedName = file.name;
    } catch (err) {
      console.error(err);
      toast.error("Error procesando archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async () => {
    if (!title.trim()) { toast.error("Añade un título"); return; }
    setAdding(true);
    try {
      const attachmentPath = (fileRef.current as any)?.__uploadedPath || null;
      const attachmentName = (fileRef.current as any)?.__uploadedName || null;

      await supabase.from("business_project_discovery").insert({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        category,
        content_text: contentText.trim() || null,
        source: attachmentPath ? "document" : "manual",
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        user_id: session?.user?.id,
      } as any);

      setTitle("");
      setDescription("");
      setContentText("");
      setCategory("need");
      if (fileRef.current) {
        fileRef.current.value = "";
        (fileRef.current as any).__uploadedPath = null;
        (fileRef.current as any).__uploadedName = null;
      }
      toast.success("Elemento añadido");
      loadItems();

      // Trigger summary refresh
      try {
        await supabase.functions.invoke("project-activity-intelligence", {
          body: { action: "refresh_summary", projectId },
        });
      } catch {}
    } catch (err) {
      toast.error("Error al guardar");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("business_project_discovery").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Elemento eliminado");
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
  const countByCategory = (cat: string) => items.filter(i => i.category === cat).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/50 bg-card/80">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground">Detección de necesidades</CardTitle>
                {items.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!open && items.length > 0 && (
                  <div className="flex gap-1">
                    {CATEGORIES.filter(c => countByCategory(c.value) > 0).map(c => (
                      <Badge key={c.value} variant="outline" className="text-[9px] px-1.5 py-0">
                        {countByCategory(c.value)} {c.label.toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Add new item */}
            <div className="space-y-2 p-3 rounded-lg border border-dashed border-border/50 bg-muted/20">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Título del elemento..."
                  className="h-8 text-sm"
                />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descripción o notas..."
                rows={2}
                className="text-xs"
              />
              {contentText && (
                <div className="p-2 rounded bg-muted/40 border border-border/30">
                  <p className="text-[10px] text-muted-foreground font-mono line-clamp-3">{contentText.substring(0, 300)}...</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                    Adjuntar
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.mp3,.m4a,.wav,.webm,.ogg"
                    onChange={handleFileUpload}
                  />
                </div>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={adding || !title.trim()}>
                  {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Añadir
                </Button>
              </div>
            </div>

            {/* Items list */}
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sin elementos. Añade necesidades, competidores, investigaciones o feedback.
              </p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {items.map(item => {
                    const catInfo = getCategoryInfo(item.category);
                    const Icon = catInfo.icon;
                    return (
                      <div key={item.id} className="flex items-start gap-2 p-2 rounded-md border border-border/30 bg-card hover:bg-muted/20 transition-colors group">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${catInfo.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">{catInfo.label}</Badge>
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                          )}
                          {item.attachment_name && (
                            <div className="flex items-center gap-1 mt-1">
                              <FileText className="w-2.5 h-2.5 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground">{item.attachment_name}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
