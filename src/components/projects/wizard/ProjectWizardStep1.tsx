import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Loader2, CheckCircle2, X, Mic, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractTextFromFile } from "@/lib/document-text-extract";

interface Props {
  onSubmit: (data: {
    name: string;
    company: string;
    contactId?: string;
    clientNeed?: string;
    inputType: string;
    inputContent: string;
    projectType: string;
  }) => void;
  saving?: boolean;
}

interface UploadedFile {
  name: string;
  text: string;
  type: string; // "audio" | "document" | "text"
  status: "processing" | "done" | "error";
}

export const ProjectWizardStep1 = ({ onSubmit, saving }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactId, setContactId] = useState("");
  const [clientNeed, setClientNeed] = useState("");
  const [projectType, setProjectType] = useState("mixto");
  const [inputType, setInputType] = useState("text");
  const [inputContent, setInputContent] = useState("");
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name")
        .then(({ data }) => setContacts(data || []));
    }
  }, [user]);

  // Rebuild combined content whenever files change
  useEffect(() => {
    const doneFiles = uploadedFiles.filter(f => f.status === "done");
    if (doneFiles.length === 0) return;
    const combined = doneFiles.map(f => `--- ${f.name} ---\n${f.text}`).join("\n\n");
    setInputContent(combined);
    // Set inputType based on whether any audio is present
    const hasAudio = doneFiles.some(f => f.type === "audio");
    setInputType(hasAudio ? "audio" : "document");
  }, [uploadedFiles]);

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
      setUploadedFiles(prev => prev.map(f => f.name === file.name && f.status === "processing" ? { ...f, text, status: "done" } : f));
    } catch (err: any) {
      toast.error(err.message || `Error procesando ${file.name}`);
      setUploadedFiles(prev => prev.filter(f => !(f.name === file.name && f.status === "processing")));
    } finally {
      setProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setInputContent("");
        setInputType("text");
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!name.trim() || !company.trim()) {
      toast.error("Nombre y empresa son obligatorios");
      return;
    }
    if (!inputContent.trim()) {
      toast.error("Necesitas aportar material de entrada (audio, texto o documento)");
      return;
    }
    onSubmit({
      name, company,
      contactId: contactId || undefined,
      clientNeed: clientNeed || undefined,
      inputType, inputContent, projectType,
    });
  };

  const hasFiles = uploadedFiles.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Section: Info básica */}
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-4">
          <p className="text-xs font-mono text-muted-foreground/70 uppercase tracking-widest">Información básica</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nombre del proyecto *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="App Móvil Empresa X" className="bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Empresa / Cliente *</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa S.L." className="bg-background" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contacto principal</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de proyecto</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultoria">Consultoría</SelectItem>
                  <SelectItem value="desarrollo">Desarrollo técnico</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Necesidad del cliente (opcional)</Label>
            <Textarea
              value={clientNeed}
              onChange={(e) => setClientNeed(e.target.value)}
              placeholder="Describe la necesidad o déjalo vacío para extraerlo del material"
              rows={2}
              className="bg-background resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: Material */}
      <Card className="border-border/50">
        <CardContent className="p-5 space-y-4">
          <p className="text-xs font-mono text-muted-foreground/70 uppercase tracking-widest">Material de entrada *</p>

          {/* Uploaded files list */}
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
                    {f.status === "done" && (
                      <p className="text-xs text-muted-foreground">{f.text.length.toLocaleString()} caracteres</p>
                    )}
                    {f.status === "processing" && (
                      <p className="text-xs text-muted-foreground">
                        {f.type === "audio" ? "Transcribiendo..." : "Extrayendo texto..."}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => removeFile(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload dropzone — always visible to allow adding more */}
          <label className={cn(
            "flex flex-col items-center gap-3 border-2 border-dashed rounded-xl cursor-pointer transition-all",
            "border-border/60 hover:border-primary/40 hover:bg-primary/5",
            hasFiles ? "p-4" : "p-8"
          )}>
            <div className={cn("rounded-xl bg-muted/50 flex items-center justify-center", hasFiles ? "w-8 h-8" : "w-12 h-12")}>
              <Upload className={cn("text-muted-foreground", hasFiles ? "w-4 h-4" : "w-5 h-5")} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {hasFiles ? "Añadir más archivos" : "Arrastra o haz clic para subir"}
              </p>
              {!hasFiles && (
                <p className="text-xs text-muted-foreground mt-0.5">Audio (.m4a, .mp3, .wav), documentos (.pdf, .docx) o texto (.txt, .md, .csv)</p>
              )}
            </div>
            <input
              type="file"
              multiple
              accept=".m4a,.mp3,.wav,.webm,.ogg,audio/*,.txt,.md,.csv,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  Array.from(files).forEach(f => handleFileUpload(f));
                }
                e.target.value = "";
              }}
            />
          </label>

          {/* Direct text input — only when no files */}
          {!hasFiles && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">O pega el texto directamente</Label>
              <Textarea
                value={inputContent}
                onChange={(e) => { setInputContent(e.target.value); setInputType("text"); }}
                placeholder="Pega aquí la transcripción, notas de la reunión, briefing del cliente..."
                rows={5}
                className="bg-background resize-none"
              />
            </div>
          )}

          {/* Combined content preview */}
          {hasFiles && uploadedFiles.some(f => f.status === "done") && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Contenido combinado · {uploadedFiles.filter(f => f.status === "done").length} archivo(s) · {inputContent.length.toLocaleString()} caracteres
              </Label>
              <Textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} rows={4} className="text-xs bg-background resize-none font-mono" />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving || processing} size="lg" className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Guardar y continuar
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
};
