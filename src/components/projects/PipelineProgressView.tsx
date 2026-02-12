import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Zap, Sparkles, Loader2, ArrowLeft, ArrowRight, Pause, Pencil, FileText, Copy, Download, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Pipeline, PipelineStep } from "@/hooks/useProjectPipeline";

const STEP_META = [
  { icon: Brain, label: "Arquitecto", color: "text-violet-400", bgActive: "bg-violet-500/20 border-violet-500/40", bgDone: "bg-violet-500/10 border-violet-500/30" },
  { icon: Zap, label: "Crítico", color: "text-emerald-400", bgActive: "bg-emerald-500/20 border-emerald-500/40", bgDone: "bg-emerald-500/10 border-emerald-500/30" },
  { icon: Sparkles, label: "Visionario", color: "text-blue-400", bgActive: "bg-blue-500/20 border-blue-500/40", bgDone: "bg-blue-500/10 border-blue-500/30" },
  { icon: Brain, label: "Consolidador", color: "text-amber-400", bgActive: "bg-amber-500/20 border-amber-500/40", bgDone: "bg-amber-500/10 border-amber-500/30" },
];

interface Props {
  pipeline: Pipeline;
  steps: PipelineStep[];
  isRunning: boolean;
  onBack: () => void;
  onContinue: () => void;
  onPause: () => void;
  onUpdateStep: (stepId: string, output: string) => void;
}

export default function PipelineProgressView({ pipeline, steps, isRunning, onBack, onContinue, onPause, onUpdateStep }: Props) {
  const [selectedStep, setSelectedStep] = useState(0);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [docOpen, setDocOpen] = useState(false);

  const currentStep = steps[selectedStep];
  const isCompleted = pipeline.status === "completed";
  const isPaused = pipeline.status === "paused";
  const isError = pipeline.status === "error";

  const canContinue = !isRunning && currentStep?.status === "completed" && selectedStep < 3 && !isCompleted;
  const showContinueForPipeline = !isRunning && !isCompleted && steps.some(s => s.status === "completed") && steps.some(s => s.status === "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pipeline Multi-Modelo</h2>
            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">{pipeline.idea_description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCompleted ? "default" : isError ? "destructive" : isPaused ? "secondary" : "outline"} className="text-xs">
            {isCompleted ? "✅ Completado" : isError ? "❌ Error" : isPaused ? "⏸ Pausado" : isRunning ? "⏳ En progreso" : "Pendiente"}
          </Badge>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between gap-2">
        {STEP_META.map((meta, i) => {
          const step = steps[i];
          const status = step?.status || "pending";
          const isActive = selectedStep === i;
          const Icon = meta.icon;

          return (
            <button
              key={i}
              onClick={() => setSelectedStep(i)}
              className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all cursor-pointer
                ${status === "in_progress" ? `${meta.bgActive} animate-pulse` : ""}
                ${status === "completed" ? meta.bgDone : ""}
                ${status === "error" ? "bg-destructive/10 border-destructive/30" : ""}
                ${status === "pending" ? "bg-muted/30 border-border" : ""}
                ${isActive ? "ring-2 ring-primary/50" : ""}
              `}
            >
              <div className="flex items-center gap-1.5">
                {status === "in_progress" ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${meta.color}`} />
                ) : status === "completed" ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Icon className={`w-4 h-4 ${status === "pending" ? "text-muted-foreground" : meta.color}`} />
                )}
                <span className={`text-xs font-medium ${status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                  {meta.label}
                </span>
              </div>
              {step?.tokens_used && (
                <span className="text-[10px] text-muted-foreground">{step.tokens_used.toLocaleString()} tokens</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Connector line */}
      <div className="flex items-center px-8 -mt-4 -mb-2">
        {[0, 1, 2].map(i => {
          const done = steps[i]?.status === "completed";
          return (
            <div key={i} className={`flex-1 h-0.5 ${done ? "bg-green-500/50" : "bg-border"} ${i < 2 ? "mr-0" : ""}`} />
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="border-border">
        <CardContent className="p-4">
          {currentStep?.status === "in_progress" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando con {currentStep.model_name}...
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {currentStep?.status === "completed" && currentStep.output_content && (
            <ScrollArea className="h-[400px]">
              {editingStep === currentStep.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="min-h-[300px] font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { onUpdateStep(currentStep.id, editText); setEditingStep(null); }}>Guardar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingStep(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-foreground">
                  <ReactMarkdown>{currentStep.output_content}</ReactMarkdown>
                </div>
              )}
            </ScrollArea>
          )}

          {currentStep?.status === "error" && (
            <div className="text-sm text-destructive">
              <p className="font-medium">Error en este paso:</p>
              <p className="text-xs mt-1">{currentStep.error_message || pipeline.error_message}</p>
            </div>
          )}

          {currentStep?.status === "pending" && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Este paso aún no se ha ejecutado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentStep?.status === "completed" && !editingStep && (
            <Button size="sm" variant="outline" onClick={() => { setEditingStep(currentStep.id); setEditText(currentStep.output_content || ""); }}>
              <Pencil className="w-3 h-3 mr-1" /> Editar resultado
            </Button>
          )}
          {isRunning && (
            <Button size="sm" variant="outline" onClick={onPause}>
              <Pause className="w-3 h-3 mr-1" /> Pausar
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {showContinueForPipeline && (
            <Button size="sm" onClick={onContinue} disabled={isRunning}>
              <ArrowRight className="w-3 h-3 mr-1" /> Continuar al paso {(pipeline.current_step || 0) + 1}
            </Button>
          )}
          {isCompleted && (
            <>
              <Button size="sm" onClick={() => setDocOpen(true)}>
                <FileText className="w-3 h-3 mr-1" /> Ver Documento Final
              </Button>
              <Button size="sm" variant="outline" disabled title="Próximamente">
                <Copy className="w-3 h-3 mr-1" /> Prompt Lovable
              </Button>
              <Button size="sm" variant="outline" disabled title="Próximamente">
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Final Document Dialog */}
      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Documento Final del Pipeline</DialogTitle></DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="prose prose-sm prose-invert max-w-none text-foreground p-4">
              <ReactMarkdown>{pipeline.final_document || ""}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
