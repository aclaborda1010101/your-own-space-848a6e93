import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, CheckCircle2, Download, Share2, Copy, Link2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QuestionItem } from "@/hooks/useBusinessLeverage";

interface Props {
  auditId?: string;
  projectSector?: string;
  projectSize?: string;
  questionnaire: QuestionItem[] | null;
  responses: Record<string, any>;
  loading: boolean;
  onGenerate: (sector: string, size: string, type?: string) => Promise<void>;
  onSaveResponses: (r: Record<string, any>) => Promise<void>;
  onAnalyze: () => Promise<void>;
  onRegenerate?: (sector: string, size: string, type?: string) => Promise<void>;
}

export const QuestionnaireTab = ({
  auditId, projectSector, projectSize, questionnaire, responses, loading,
  onGenerate, onSaveResponses, onAnalyze, onRegenerate,
}: Props) => {
  const [sector, setSector] = useState(projectSector || "");
  const [size, setSize] = useState(projectSize || "micro");
  const [businessType, setBusinessType] = useState("");
  const [localResponses, setLocalResponses] = useState<Record<string, any>>(responses);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);

  useEffect(() => {
    setLocalResponses(responses);
  }, [responses]);

  // Load public share state
  useEffect(() => {
    if (!auditId) return;
    supabase.from("bl_audits").select("public_token, public_questionnaire_enabled").eq("id", auditId).single()
      .then(({ data }) => {
        if (data) {
          setPublicEnabled(!!data.public_questionnaire_enabled);
          setPublicToken(data.public_token as string);
        }
      });
  }, [auditId]);

  const togglePublicAccess = async (enabled: boolean) => {
    if (!auditId) return;
    setLoadingShare(true);
    try {
      await supabase.from("bl_audits").update({ public_questionnaire_enabled: enabled }).eq("id", auditId);
      setPublicEnabled(enabled);
      toast.success(enabled ? "Enlace público activado" : "Enlace público desactivado");
    } catch { toast.error("Error"); }
    finally { setLoadingShare(false); }
  };

  const publicUrl = publicToken && auditId
    ? `${window.location.origin}/audit/${auditId}/questionnaire?token=${publicToken}`
    : null;

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success("Enlace copiado al portapapeles");
    }
  };

  const updateResponse = (qId: string, value: any) => {
    const updated = { ...localResponses, [qId]: value };
    setLocalResponses(updated);
    onSaveResponses(updated);
  };

  const answeredCount = Object.keys(localResponses).filter(k => localResponses[k] !== "" && localResponses[k] !== undefined).length;
  const totalQuestions = questionnaire?.length || 0;
  const allAnswered = totalQuestions > 0 && answeredCount >= totalQuestions;

  if (!questionnaire) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Configura el negocio para generar un cuestionario adaptado.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Sector *</Label>
              <Input value={sector} onChange={e => setSector(e.target.value)} placeholder="Peluquería, Clínica, Retail..." />
            </div>
            <div>
              <Label>Tamaño</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro (1-5 pers.)</SelectItem>
                  <SelectItem value="small">Pequeño (6-20)</SelectItem>
                  <SelectItem value="medium">Mediano (21-100)</SelectItem>
                  <SelectItem value="large">Grande (100+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de negocio</Label>
              <Input value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="Servicios, Producto..." />
            </div>
          </div>
          <Button onClick={() => onGenerate(sector, size, businessType)} disabled={!sector.trim() || loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generar cuestionario
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">{answeredCount}/{totalQuestions} respondidas</Badge>
        <div className="flex gap-2 flex-wrap">
          {onRegenerate && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1" disabled={loading}>
                  <RefreshCw className="w-4 h-4" /> Regenerar cuestionario
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Regenerar cuestionario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se generará un nuevo cuestionario y se borrarán todas las respuestas, radiografía, recomendaciones y roadmap existentes. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRegenerate(sector, size, businessType)}>
                    Regenerar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {auditId && questionnaire && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowSharePanel(!showSharePanel)}>
              <Share2 className="w-4 h-4" /> Compartir
            </Button>
          )}
          {totalQuestions > 0 && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => {
              const lines = (questionnaire || []).map((q, i) => {
                const answer = localResponses[q.id];
                const answerStr = Array.isArray(answer) ? answer.join(", ") : (answer ?? "Sin respuesta");
                return `### ${i + 1}. ${q.question}\n**Respuesta:** ${answerStr}\n`;
              });
              const md = `# Cuestionario de Auditoría IA\n\n${lines.join("\n")}`;
              const blob = new Blob([md], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "cuestionario.md"; a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4" /> Exportar MD
            </Button>
          )}
          <Button onClick={onAnalyze} disabled={!allAnswered || loading} size="sm" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Generar radiografía
          </Button>
        </div>
      </div>

      {/* Share panel */}
      {showSharePanel && auditId && (
        <Card className="border-primary/30 bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Cuestionario público para cliente</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{publicEnabled ? "Activo" : "Inactivo"}</span>
                <Switch checked={publicEnabled} onCheckedChange={togglePublicAccess} disabled={loadingShare} />
              </div>
            </div>
            {publicEnabled && publicUrl && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="text-xs h-8 font-mono" />
                  <Button variant="outline" size="sm" onClick={copyLink} className="gap-1 shrink-0">
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  El cliente puede abrir este enlace y rellenar el cuestionario directamente. Las respuestas se guardan automáticamente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-4 pr-2">
      {questionnaire
        .filter(q => {
          // Hide q3b unless q3 answer is "Más de 50 farmacias"
          if (q.id === "q3b") {
            return localResponses["q3"] === "Más de 50 farmacias";
          }
          return true;
        })
        .map((q, i) => (
        <Card key={q.id} className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">{i + 1}.</span>
              {q.question}
              {q.priority === "high" && <Badge variant="outline" className="text-xs text-primary border-primary/30">Clave</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {q.type === "open" && (
              <Textarea
                value={localResponses[q.id] || ""}
                onChange={e => updateResponse(q.id, e.target.value)}
                placeholder="Tu respuesta..."
                rows={2}
              />
            )}
            {q.type === "yes_no" && (
              <div className="flex gap-2">
                {["Sí", "No"].map(opt => (
                  <Button
                    key={opt}
                    variant={localResponses[q.id] === opt ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateResponse(q.id, opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
            {q.type === "single_choice" && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map(opt => (
                  <Button
                    key={opt}
                    variant={localResponses[q.id] === opt ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateResponse(q.id, opt)}
                    className="text-xs"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
            {q.type === "multi_choice" && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map(opt => {
                  const selected = (localResponses[q.id] || []) as string[];
                  const isSelected = selected.includes(opt);
                  return (
                    <Button
                      key={opt}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const next = isSelected ? selected.filter(s => s !== opt) : [...selected, opt];
                        updateResponse(q.id, next);
                      }}
                      className="text-xs"
                    >
                      {opt}
                    </Button>
                  );
                })}
              </div>
            )}
            {q.type === "scale_1_10" && (
              <div className="flex items-center gap-4">
                <Slider
                  value={[localResponses[q.id] || 5]}
                  onValueChange={([v]) => updateResponse(q.id, v)}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-primary w-6 text-center">{localResponses[q.id] || 5}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      </div>
      </ScrollArea>
    </div>
  );
};
