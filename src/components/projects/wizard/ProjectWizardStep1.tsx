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
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [audioStep, setAudioStep] = useState<"idle" | "transcribing" | "done">("idle");
  const [audioFileName, setAudioFileName] = useState("");

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

  const handleFileUpload = async (file: File) => {
    const isAudio = file.type.startsWith("audio/") || /\.(m4a|mp3|wav|webm|ogg)$/i.test(file.name);
    
    if (isAudio) {
      setInputType("audio");
      setAudioFileName(file.name);
      setAudioProcessing(true);
      setAudioStep("transcribing");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", "es");
        const { data, error } = await supabase.functions.invoke("speech-to-text", { body: formData });
        if (error || !data?.text) throw new Error(error?.message || "Error en la transcripción");
        setInputContent(data.text);
        setAudioStep("done");
        toast.success("Audio transcrito correctamente");
      } catch (err: any) {
        toast.error(err.message || "Error procesando audio");
        setAudioStep("idle");
        setAudioFileName("");
      } finally {
        setAudioProcessing(false);
      }
    } else {
      setInputType("document");
      setAudioFileName(file.name);
      try {
        const text = await file.text();
        setInputContent(text);
        setAudioStep("done");
        toast.success("Archivo cargado");
      } catch {
        toast.error("Error leyendo archivo");
      }
    }
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

          {audioStep === "idle" ? (
            <label className={cn(
              "flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all",
              "border-border/60 hover:border-primary/40 hover:bg-primary/5"
            )}>
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Arrastra o haz clic para subir</p>
                <p className="text-xs text-muted-foreground mt-0.5">Audio (.m4a, .mp3, .wav) o texto (.txt, .md, .csv)</p>
              </div>
              <input
                type="file"
                accept=".m4a,.mp3,.wav,.webm,.ogg,audio/*,.txt,.md,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          ) : audioStep === "transcribing" ? (
            <div className="flex items-center gap-4 p-5 border border-primary/20 rounded-xl bg-primary/5">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{audioFileName}</p>
                <p className="text-xs text-muted-foreground">Transcribiendo audio con Whisper...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 border border-green-500/20 rounded-xl bg-green-500/5">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Material cargado</p>
                <p className="text-xs text-muted-foreground truncate">{audioFileName || "Texto directo"}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setAudioStep("idle"); setAudioFileName(""); setInputContent(""); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Direct text input */}
          {audioStep === "idle" && (
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

          {audioStep === "done" && inputContent && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contenido cargado · {inputContent.length.toLocaleString()} caracteres</Label>
              <Textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} rows={4} className="text-xs bg-background resize-none font-mono" />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving || audioProcessing} size="lg" className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Guardar y continuar
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
};
