import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

interface QuestionItem {
  id: string;
  question: string;
  type: "single_choice" | "multi_choice" | "open" | "yes_no" | "scale_1_10";
  options: string[] | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callPublicEdge(action: string, params: Record<string, any>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-business-leverage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

const PublicQuestionnaire = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditName, setAuditName] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [completed, setCompleted] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!auditId || !token) {
      setError("Enlace inválido. Contacta con tu consultor.");
      setLoading(false);
      return;
    }
    loadQuestionnaire();
  }, [auditId, token]);

  const loadQuestionnaire = async () => {
    try {
      const data = await callPublicEdge("public_load_questionnaire", {
        audit_id: auditId,
        token,
      });
      setAuditName(data.audit_name || "Cuestionario");
      setQuestions(data.questions || []);
      setResponses(data.responses || {});
      setCompleted(!!data.completed);
      setClientName(data.client_name || "");
      setClientEmail(data.client_email || "");
    } catch (e: any) {
      setError(e.message || "Error cargando cuestionario");
    } finally {
      setLoading(false);
    }
  };

  const saveResponse = useCallback(
    (questionId: string, value: any, allResponses: Record<string, any>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await callPublicEdge("public_save_response", {
            audit_id: auditId,
            token,
            question_id: questionId,
            value,
            all_responses: allResponses,
            client_name: clientName,
            client_email: clientEmail,
          });
        } catch (e) {
          console.error("Error saving response:", e);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [auditId, token, clientName, clientEmail]
  );

  const updateResponse = (qId: string, value: any) => {
    const updated = { ...responses, [qId]: value };
    setResponses(updated);
    saveResponse(qId, value, updated);
  };

  const answeredCount = Object.keys(responses).filter(
    (k) => responses[k] !== "" && responses[k] !== undefined
  ).length;
  const totalQuestions = questions.length;
  const allAnswered = totalQuestions > 0 && answeredCount >= totalQuestions;

  const handleComplete = async () => {
    try {
      setSaving(true);
      await callPublicEdge("public_complete_questionnaire", {
        audit_id: auditId,
        token,
        client_name: clientName,
        client_email: clientEmail,
      });
      setCompleted(true);
    } catch (e: any) {
      console.error("Error completing:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <ShieldCheck className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">¡Gracias!</h2>
            <p className="text-sm text-muted-foreground">
              Tu cuestionario ha sido completado. Tu consultor revisará las respuestas
              y se pondrá en contacto contigo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{auditName}</h1>
          <p className="text-sm text-muted-foreground">
            Responde las siguientes preguntas. Tus respuestas se guardan automáticamente.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              {answeredCount}/{totalQuestions} respondidas
            </Badge>
            {saving && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Guardando...
              </Badge>
            )}
          </div>
        </div>

        {/* Client info */}
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Tus datos (opcional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Tu nombre"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="tu@email.com"
                  type="email"
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          {questions
            .filter((q) => {
              if (q.id === "q3b") return responses["q3"] === "Más de 50 farmacias";
              return true;
            })
            .map((q, i) => (
              <Card key={q.id} className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{i + 1}.</span>
                    {q.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {q.type === "open" && (
                    <Textarea
                      value={responses[q.id] || ""}
                      onChange={(e) => updateResponse(q.id, e.target.value)}
                      placeholder="Tu respuesta..."
                      rows={2}
                    />
                  )}
                  {q.type === "yes_no" && (
                    <div className="flex gap-2">
                      {["Sí", "No"].map((opt) => (
                        <Button
                          key={opt}
                          variant={responses[q.id] === opt ? "default" : "outline"}
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
                      {q.options.map((opt) => (
                        <Button
                          key={opt}
                          variant={responses[q.id] === opt ? "default" : "outline"}
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
                      {q.options.map((opt) => {
                        const selected = (responses[q.id] || []) as string[];
                        const isSelected = selected.includes(opt);
                        return (
                          <Button
                            key={opt}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const next = isSelected
                                ? selected.filter((s) => s !== opt)
                                : [...selected, opt];
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
                        value={[responses[q.id] || 5]}
                        onValueChange={([v]) => updateResponse(q.id, v)}
                        min={1}
                        max={10}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono text-primary w-6 text-center">
                        {responses[q.id] || 5}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Complete button */}
        {allAnswered && (
          <div className="text-center pt-4">
            <Button onClick={handleComplete} disabled={saving} size="lg" className="gap-2">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Enviar cuestionario completado
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicQuestionnaire;
