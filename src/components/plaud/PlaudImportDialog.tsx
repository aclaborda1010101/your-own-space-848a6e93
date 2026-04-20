import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Brain, X, Check, Users, Briefcase, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recordFeedback } from "@/lib/jarvisFeedback";
import type { PlaudSuggestion } from "@/hooks/usePlaudImportSuggestions";

export interface PlaudImportConfirmation {
  projectId: string | null;
  contactIds: string[];
  contextType: "professional" | "family" | "personal";
  /** false → "Importar sin asociar" — el usuario decidió no enlazar */
  associate: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: string | null;
  suggestion: PlaudSuggestion | null;
  /** Texto del transcript (excerpt) que generó la sugerencia, para feedback. */
  excerpt: string;
  title: string;
  onConfirm: (confirmation: PlaudImportConfirmation) => Promise<void> | void;
}

const CONTEXT_LABEL: Record<string, { label: string; icon: any; cls: string }> = {
  professional: { label: "Profesional", icon: Briefcase, cls: "bg-primary/15 text-primary border-primary/30" },
  family: { label: "Familia / Bosco", icon: Heart, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  personal: { label: "Personal", icon: Users, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

export function PlaudImportDialog({
  open,
  onOpenChange,
  loading,
  error,
  suggestion,
  excerpt,
  title,
  onConfirm,
}: Props) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);

  // Estado editable que el usuario puede modificar antes de confirmar
  const [selectedProjectId, setSelectedProjectId] = useState<string>("__none__");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contextType, setContextType] = useState<"professional" | "family" | "personal">("professional");
  const [submitting, setSubmitting] = useState(false);

  // Cargar listas al abrir
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [pr, co] = await Promise.all([
        supabase
          .from("business_projects")
          .select("id, name")
          .eq("user_id", user.id)
          .neq("status", "closed")
          .order("name")
          .limit(120),
        supabase
          .from("people_contacts")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name")
          .limit(400),
      ]);
      setProjects(pr.data || []);
      setContacts(co.data || []);
    })();
  }, [open, user]);

  // Pre-rellenar con la sugerencia cuando llega
  useEffect(() => {
    if (!suggestion) return;
    setSelectedProjectId(suggestion.project?.id || "__none__");
    setSelectedContactIds(suggestion.contacts.filter((c) => c.id).map((c) => c.id));
    setContextType(suggestion.context_type);
  }, [suggestion]);

  const ctxCfg = CONTEXT_LABEL[contextType] || CONTEXT_LABEL.professional;
  const CtxIcon = ctxCfg.icon;

  const suggestedContactIds = useMemo(
    () => new Set((suggestion?.contacts || []).filter((c) => c.id).map((c) => c.id)),
    [suggestion],
  );

  const initialProjectId = suggestion?.project?.id || null;

  async function emitFeedback(associate: boolean) {
    if (!user) return;
    try {
      const finalProjectId = associate && selectedProjectId !== "__none__" ? selectedProjectId : null;
      const wasCorrect = associate && finalProjectId === initialProjectId && initialProjectId !== null;
      await recordFeedback({
        userId: user.id,
        feedbackType: wasCorrect ? "suggestion_accept" : "classification_correct",
        suggestionType: "classification_from_plaud",
        initialConfidence: suggestion?.project?.confidence ?? null,
        initialValue: {
          project_id: initialProjectId,
          contact_ids: Array.from(suggestedContactIds),
          context_type: suggestion?.context_type,
        },
        correctedValue: {
          project_id: finalProjectId,
          contact_ids: associate ? selectedContactIds : [],
          context_type: contextType,
          associate,
        },
        context: {
          excerpt: excerpt.slice(0, 600),
          title,
          source: "plaud_import_dialog",
        },
      });
    } catch (e) {
      console.warn("[PlaudImportDialog] feedback no registrado:", e);
    }
  }

  async function handleConfirm(associate: boolean) {
    setSubmitting(true);
    try {
      await emitFeedback(associate);
      await onConfirm({
        projectId: associate && selectedProjectId !== "__none__" ? selectedProjectId : null,
        contactIds: associate ? selectedContactIds : [],
        contextType,
        associate,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleContact(id: string) {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugerencia previa al import
          </DialogTitle>
          <DialogDescription className="text-xs">
            JARVIS ha analizado el contenido. Revisa y ajusta antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Analizando contenido…
          </div>
        )}

        {error && !loading && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
            No se pudo generar sugerencia: {error}. Puedes importar sin asociar.
          </div>
        )}

        {!loading && suggestion && (
          <div className="space-y-4">
            {suggestion.auto_assign && (
              <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3">
                <Brain className="h-4 w-4 text-success mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-success">Auto-asignación aprendida</p>
                  <p className="text-muted-foreground">
                    JARVIS ya clasifica este tipo de grabaciones automáticamente porque tú lo
                    confirmaste {suggestion.learned_patterns_used[0]?.evidence ?? "varias"} veces.
                  </p>
                </div>
              </div>
            )}

            {/* Resumen 1 línea */}
            {suggestion.summary_one_line && (
              <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">
                "{suggestion.summary_one_line}"
              </p>
            )}

            {/* Proyecto */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proyecto sugerido
                </label>
                {suggestion.project && (
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(suggestion.project.confidence * 100)}%
                  </Badge>
                )}
              </div>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin proyecto —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.id === initialProjectId ? " ⭐" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suggestion.project?.reasoning && (
                <p className="text-[11px] text-muted-foreground">{suggestion.project.reasoning}</p>
              )}
            </div>

            {/* Personas */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Personas mencionadas
              </label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {suggestion.contacts.length === 0 && (
                  <span className="text-[11px] text-muted-foreground italic">
                    Ninguna detectada.
                  </span>
                )}
                {suggestion.contacts.map((c) => {
                  const active = c.id ? selectedContactIds.includes(c.id) : false;
                  return (
                    <button
                      key={`${c.id || c.name}`}
                      type="button"
                      disabled={!c.id}
                      onClick={() => c.id && toggleContact(c.id)}
                      className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-1 transition-colors ${
                        active
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      } ${!c.id ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {c.name}
                      <span className="opacity-70">{Math.round(c.confidence * 100)}%</span>
                    </button>
                  );
                })}
              </div>
              {/* Permitir añadir manualmente uno extra */}
              <Select
                value="__add__"
                onValueChange={(v) => {
                  if (v && v !== "__add__" && !selectedContactIds.includes(v)) {
                    setSelectedContactIds((prev) => [...prev, v]);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Añadir otra persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add__" disabled>+ Añadir otra persona</SelectItem>
                  {contacts
                    .filter((c) => !suggestedContactIds.has(c.id) && !selectedContactIds.includes(c.id))
                    .slice(0, 200)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedContactIds
                .filter((id) => !suggestedContactIds.has(id))
                .map((id) => {
                  const c = contacts.find((x) => x.id === id);
                  if (!c) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/40 mr-1"
                    >
                      {c.name}
                      <button
                        type="button"
                        onClick={() => toggleContact(id)}
                        className="hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
            </div>

            {/* Contexto */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contexto
              </label>
              <div className="flex gap-1.5">
                {(["professional", "family", "personal"] as const).map((ctx) => {
                  const cfg = CONTEXT_LABEL[ctx];
                  const Icon = cfg.icon;
                  const active = ctx === contextType;
                  return (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() => setContextType(ctx)}
                      className={`text-[11px] px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                        active ? cfg.cls : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => handleConfirm(false)}
            disabled={submitting || loading}
            className="sm:mr-auto"
          >
            Importar sin asociar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => handleConfirm(true)} disabled={submitting || loading}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Confirmar e importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
