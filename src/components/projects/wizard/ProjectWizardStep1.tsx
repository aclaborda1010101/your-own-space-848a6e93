import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Loader2, CheckCircle2, X, Mic, FileText } from "lucide-react";
import { toast } from "sonner";

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
        toast.success("Audio transcrito");
      } catch (err: any) {
        toast.error(err.message || "Error procesando audio");
        setAudioStep("idle");
        setAudioFileName("");
      } finally {
        setAudioProcessing(false);
      }
    } else {
      // Text file
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
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-foreground">Entrada del Proyecto</h2>
        <p className="text-sm text-muted-foreground mt-1">Define el proyecto y sube el material de entrada.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Nombre del proyecto *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="App Móvil Empresa X" />
        </div>
        <div>
          <Label>Empresa / Cliente *</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa S.L." />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Contacto principal</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de proyecto</Label>
          <Select value={projectType} onValueChange={setProjectType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consultoria">Consultoría</SelectItem>
              <SelectItem value="desarrollo">Desarrollo técnico</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Necesidad del cliente (opcional)</Label>
        <Textarea
          value={clientNeed}
          onChange={(e) => setClientNeed(e.target.value)}
          placeholder="Describe la necesidad o déjalo vacío para extraerlo del material"
          rows={3}
        />
      </div>

      {/* Upload area */}
      <div>
        <Label>Material de entrada *</Label>
        {audioStep === "idle" ? (
          <label className="flex flex-col items-center gap-2 p-6 mt-1 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/5 transition-all">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              Sube un audio, documento de texto, o escribe directamente
            </span>
            <span className="text-xs text-muted-foreground/60">.m4a, .mp3, .wav, .txt, .md, .csv</span>
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
          <div className="flex items-center gap-3 p-4 mt-1 border border-border rounded-xl bg-muted/5">
            <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground truncate">{audioFileName}</p>
              <p className="text-xs text-muted-foreground">Transcribiendo audio...</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 mt-1 border border-primary/30 rounded-xl bg-primary/5">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Material cargado</p>
              <p className="text-xs text-muted-foreground truncate">{audioFileName || "Texto directo"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setAudioStep("idle"); setAudioFileName(""); setInputContent(""); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Direct text input */}
      {audioStep === "idle" && (
        <div>
          <Label>O pega el texto directamente</Label>
          <Textarea
            value={inputContent}
            onChange={(e) => { setInputContent(e.target.value); setInputType("text"); }}
            placeholder="Pega aquí la transcripción, notas de la reunión, briefing del cliente..."
            rows={6}
          />
        </div>
      )}

      {audioStep === "done" && inputContent && (
        <div>
          <Label>Contenido cargado ({inputContent.length} caracteres)</Label>
          <Textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} rows={4} className="text-xs" />
        </div>
      )}

      <Button onClick={handleSubmit} disabled={saving || audioProcessing} className="w-full sm:w-auto">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Guardar y continuar →
      </Button>
    </div>
  );
};
