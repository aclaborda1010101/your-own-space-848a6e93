import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SOURCES = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Emails" },
  { key: "transcription", label: "Transcripciones" },
  { key: "plaud", label: "Plaud" },
  { key: "project", label: "Proyectos" },
  { key: "contact_note", label: "Notas de contactos" },
] as const;

type SourceKey = typeof SOURCES[number]["key"];
type Status = "idle" | "running" | "ok" | "error";

interface SourceState {
  status: Status;
  processed?: number;
  error?: string;
}

export function JarvisReindexCard() {
  const { user } = useAuth();
  const [states, setStates] = useState<Record<SourceKey, SourceState>>(
    () => Object.fromEntries(SOURCES.map((s) => [s.key, { status: "idle" }])) as Record<SourceKey, SourceState>
  );
  const [running, setRunning] = useState(false);

  const runOne = async (sourceType: SourceKey) => {
    setStates((prev) => ({ ...prev, [sourceType]: { status: "running" } }));
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-history-ingest", {
        body: {
          mode: "backfill",
          user_id: user?.id,
          source_type: sourceType,
          batch_size: 100,
          days: 365,
        },
      });
      if (error) throw error;
      const processed = data?.processed ?? data?.count ?? 0;
      setStates((prev) => ({ ...prev, [sourceType]: { status: "ok", processed } }));
    } catch (e: any) {
      setStates((prev) => ({
        ...prev,
        [sourceType]: { status: "error", error: e?.message || String(e) },
      }));
    }
  };

  const runAll = async () => {
    if (!user?.id) {
      toast.error("Necesitas iniciar sesión");
      return;
    }
    setRunning(true);
    toast.info("Indexando todo el histórico... esto puede tardar varios minutos");
    await Promise.allSettled(SOURCES.map((s) => runOne(s.key)));
    setRunning(false);
    toast.success("Reindexación completada. JARVIS ya tiene el contexto actualizado.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Procesa todo tu histórico (365 días) de WhatsApp, emails, transcripciones, Plaud, proyectos y notas de
        contactos para que JARVIS pueda responder con contexto completo. Útil tras importar datos nuevos.
      </p>

      <Button onClick={runAll} disabled={running} className="gap-2">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {running ? "Indexando..." : "Reindexar todo el conocimiento"}
      </Button>

      <div className="grid gap-2 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const st = states[s.key];
          return (
            <div
              key={s.key}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm font-medium">{s.label}</span>
              <div className="flex items-center gap-2">
                {st.status === "idle" && <Badge variant="outline">Pendiente</Badge>}
                {st.status === "running" && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Procesando
                  </Badge>
                )}
                {st.status === "ok" && (
                  <Badge variant="default" className="gap-1 bg-primary/20 text-primary hover:bg-primary/30">
                    <CheckCircle2 className="h-3 w-3" /> {st.processed ?? 0}
                  </Badge>
                )}
                {st.status === "error" && (
                  <Badge variant="destructive" className="gap-1" title={st.error}>
                    <AlertCircle className="h-3 w-3" /> Error
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
