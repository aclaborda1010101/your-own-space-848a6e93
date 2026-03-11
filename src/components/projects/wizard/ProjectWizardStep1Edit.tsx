import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, Pencil, Save, ArrowRight, Sparkles, RotateCcw,
  Upload, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractTextFromFile } from "@/lib/document-text-extract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadedFile {
  name: string;
  text: string;
  type: string;
  status: "processing" | "done" | "error";
}

interface Props {
  inputContent: string;
  onUpdateContent: (content: string) => Promise<void>;
  onGoToExtraction: () => void;
  onReExtract: () => void;
  hasExistingBriefing: boolean;
  generating: boolean;
}

export const ProjectWizardStep1Edit = ({
  inputContent,
  onUpdateContent,
  onGoToExtraction,
  onReExtract,
  hasExistingBriefing,
  generating,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inputContent);
  const [saving, setSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateContent(draft);
    setSaving(false);
    setEditing(false);
  };

  const handleSaveAndReExtract = async () => {
    setSaving(true);
    await onUpdateContent(draft);
    setSaving(false);
    setEditing(false);
    onReExtract();
  };

  const handleFileUpload = async (file: File) => {
    const isAudio = file.type.startsWith("audio/") || /\.(m4a|mp3|wav|webm|ogg)$/i.test(file.name);
    const fileEntry: UploadedFile = { name: file.name, text: "", type: isAudio ? "audio" : "document", status: "processing" };
    setUploadedFiles(prev => [...prev, fileEntry]);
    setProcessing(true);

    try {
      let text = "";
      if (isAudio) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", "es");
        const { data, error } = await supabase.functions.invoke("speech-to-text", { body: formData });
        if (error || !data?.text) throw new Error(error?.message || "Error en la transcripción");
        text = data.text;
        toast.success(`Audio "${file.name}" transcrito`);
      } else {
        const result = await extractTextFromFile(file);
        text = result.text;
        toast.success(`"${file.name}" cargado`);
      }

      setUploadedFiles(prev => prev.map(f =>
        f.name === file.name && f.status === "processing" ? { ...f, text, status: "done" } : f
      ));

      // Append extracted text to draft
      const separator = `\n\n--- ${file.name} ---\n`;
      setDraft(prev => prev ? prev + separator + text : separator + text);
    } catch (err: any) {
      toast.error(err.message || `Error procesando ${file.name}`);
      setUploadedFiles(prev => prev.filter(f => !(f.name === file.name && f.status === "processing")));
    } finally {
      setProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    const file = uploadedFiles[index];
    if (file?.status === "done" && file.text) {
      // Remove this file's text from the draft
      const marker = `--- ${file.name} ---`;
      const lines = draft.split("\n");
      const filtered: string[] = [];
      let skipping = false;
      for (const line of lines) {
        if (line.includes(marker)) {
          skipping = true;
          continue;
        }
        if (skipping && line.startsWith("--- ") && line.endsWith(" ---")) {
          skipping = false;
        }
        if (!skipping) filtered.push(line);
      }
      setDraft(filtered.join("\n").trim());
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const hasChanges = draft !== inputContent;

  if (!editing) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">Entrada completada</h2>
              <p className="text-sm text-muted-foreground mt-1">
                El proyecto se ha creado correctamente. Puedes editar el material de entrada si necesitas añadir o corregir información.
              </p>
            </div>
          </div>

          <Card className="border-border/30 bg-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Material de entrada · {inputContent.length.toLocaleString()} caracteres
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {inputContent.split(/\s+/).length.toLocaleString()} palabras
                </Badge>
              </div>
              <ScrollArea className="h-32">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-8">
                  {inputContent}
                </p>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setDraft(inputContent); setEditing(true); }} className="gap-2">
              <Pencil className="w-4 h-4" /> Editar material
            </Button>
            {hasExistingBriefing ? (
              <Button onClick={onGoToExtraction} className="gap-2">
                Ir a Extracción <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={onReExtract} className="gap-2 shadow-lg shadow-primary/20" disabled={generating}>
                <Sparkles className="w-4 h-4" /> Extraer briefing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Editing mode
  return (
    <Card className="border-primary/30 border-2">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Pencil className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Editar Material de Entrada</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Añade archivos, corrige o amplía el contenido. Al guardar se regenerará el briefing automáticamente.
            </p>
          </div>
        </div>

        {/* File upload zone */}
        <div className="space-y-3">
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              {uploadedFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  f.status === "processing" ? "border-primary/20 bg-primary/5" : "border-border/50 bg-muted/30"
                )}>
                  {f.status === "processing" ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.status === "processing"
                        ? (f.type === "audio" ? "Transcribiendo..." : "Extrayendo texto...")
                        : `${f.text.length.toLocaleString()} caracteres extraídos`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => removeFile(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <label className={cn(
            "flex flex-col items-center gap-2 border-2 border-dashed rounded-xl cursor-pointer transition-all p-4",
            "border-border/60 hover:border-primary/40 hover:bg-primary/5"
          )}>
            <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Adjuntar archivos</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, audio (.m4a, .mp3), texto (.txt, .csv, .md)</p>
            </div>
            <input
              type="file"
              multiple
              accept=".m4a,.mp3,.wav,.webm,.ogg,audio/*,.txt,.md,.csv,.pdf,.docx,.xlsx"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files) Array.from(files).forEach(f => handleFileUpload(f));
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          className="text-sm bg-background resize-y min-h-[200px] font-mono"
          placeholder="Pega aquí la transcripción, notas de reunión o descripción del proyecto..."
        />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            {draft.length.toLocaleString()} caracteres · {draft.split(/\s+/).filter(Boolean).length.toLocaleString()} palabras
            {hasChanges && (
              <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/40 text-amber-600">
                Sin guardar
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setDraft(inputContent); setEditing(false); setUploadedFiles([]); }} size="sm">
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || processing || !hasChanges}
              size="sm"
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Solo guardar
            </Button>
            <Button
              onClick={handleSaveAndReExtract}
              disabled={saving || generating || processing}
              size="sm"
              className="gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Guardar y re-extraer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
