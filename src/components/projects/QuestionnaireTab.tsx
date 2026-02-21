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
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import type { QuestionItem } from "@/hooks/useBusinessLeverage";

interface Props {
  projectSector?: string;
  projectSize?: string;
  questionnaire: QuestionItem[] | null;
  responses: Record<string, any>;
  loading: boolean;
  onGenerate: (sector: string, size: string, type?: string) => Promise<void>;
  onSaveResponses: (r: Record<string, any>) => Promise<void>;
  onAnalyze: () => Promise<void>;
}

export const QuestionnaireTab = ({
  projectSector, projectSize, questionnaire, responses, loading,
  onGenerate, onSaveResponses, onAnalyze,
}: Props) => {
  const [sector, setSector] = useState(projectSector || "");
  const [size, setSize] = useState(projectSize || "micro");
  const [businessType, setBusinessType] = useState("");
  const [localResponses, setLocalResponses] = useState<Record<string, any>>(responses);

  useEffect(() => {
    setLocalResponses(responses);
  }, [responses]);

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
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">{answeredCount}/{totalQuestions} respondidas</Badge>
        <Button onClick={onAnalyze} disabled={!allAnswered || loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Generar radiografía
        </Button>
      </div>

      <ScrollArea className="max-h-[60vh]">
      <div className="space-y-4 pr-2">
      {questionnaire.map((q, i) => (
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
