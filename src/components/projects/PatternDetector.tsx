import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Radar, Database, Shield, Layers, BarChart3, FileSpreadsheet,
  Plus, Loader2, ChevronDown, ExternalLink, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, Info,
  Award, Eye, Euro, Target, Lightbulb, RefreshCw,
} from "lucide-react";
import { usePatternDetector, Signal, CredibilityData, EconomicBacktest } from "@/hooks/usePatternDetector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { PatternDetectorSetup } from "./PatternDetectorSetup";
import { PatternIntentReview, TranslatedIntent } from "./PatternIntentReview";

const phaseLabels: Record<number, string> = {
  0: "Pendiente", 1: "Dominio", 2: "Fuentes", 3: "Quality Gate",
  4: "Datos", 5: "Patrones", 6: "Backtesting", 7: "Hipótesis",
};

const layerColors: Record<number, string> = {
  1: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  2: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  3: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  4: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  5: "bg-red-500/10 text-red-400 border-red-500/30",
};

const trendIcon = (t: string) => {
  if (t === "up") return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (t === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

const impactBadge = (i: string) => {
  const colors: Record<string, string> = {
    high: "bg-red-500/10 text-red-400",
    medium: "bg-amber-500/10 text-amber-400",
    low: "bg-green-500/10 text-green-400",
  };
  return <Badge variant="outline" className={cn("text-xs", colors[i])}>{i}</Badge>;
};

const credibilityClassColors: Record<string, { bg: string; text: string; border: string }> = {
  Alpha: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  Beta: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  Fragile: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  Noise: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
};

const regimeBadgeColors: Record<string, string> = {
  normal: "bg-green-500/10 text-green-400 border-green-500/30",
  demand_shock: "bg-red-500/10 text-red-400 border-red-500/30",
  supply_shock: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  regulatory_change: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  unknown_anomaly: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

export const PatternDetector = ({ projectId }: { projectId?: string }) => {
  const {
    currentRun, sources, signals, backtests, economicBacktests, credibility, discoveries, loading, polling, createRun, translateIntent,
  } = usePatternDetector(projectId);

  const [setupOpen, setSetupOpen] = useState(false);
  const [reviewIntent, setReviewIntent] = useState<TranslatedIntent | null>(null);
  const [reviewParams, setReviewParams] = useState<{ sector: string; geography?: string; time_horizon?: string; business_objective?: string } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const isRunning = polling || currentRun?.status?.startsWith("running_");
  const progress = currentRun ? (currentRun.current_phase / 7) * 100 : 0;

  // Group signals by layer
  const signalsByLayer = signals.reduce<Record<number, Signal[]>>((acc, s) => {
    if (!acc[s.layer_id]) acc[s.layer_id] = [];
    acc[s.layer_id].push(s);
    return acc;
  }, {});

  const backtest = backtests[0];
  const ecoBacktest = economicBacktests[0] as EconomicBacktest | undefined;

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      {currentRun && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                <span className="text-sm font-mono text-muted-foreground">
                  Fase {currentRun.current_phase}/7 — {phaseLabels[currentRun.current_phase] || currentRun.status}
                </span>
              </div>
              <Badge variant="outline" className={cn("text-xs",
                currentRun.status === "completed" ? "text-green-400 border-green-500/30" :
                currentRun.status === "blocked" ? "text-red-400 border-red-500/30" :
                currentRun.status === "failed" ? "text-red-400 border-red-500/30" :
                "text-primary border-primary/30"
              )}>
                {currentRun.status === "completed" ? "✓ Completado" :
                 currentRun.status === "blocked" ? "⊘ Bloqueado" :
                 currentRun.status === "failed" ? "✕ Fallido" :
                 "En progreso"}
              </Badge>
            </div>
            <Progress value={progress} className="h-1.5" />
            {currentRun.sector && (
              <p className="text-xs text-muted-foreground mt-2">
                {currentRun.sector} • {currentRun.geography || "Global"} • {currentRun.business_objective?.slice(0, 80)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Verdict Card */}
      {currentRun?.model_verdict && currentRun.status === "completed" && (
        <Card className={cn("border",
          currentRun.model_verdict === "VALID" ? "border-green-500/30 bg-green-500/5" :
          currentRun.model_verdict === "BLOCKED" ? "border-red-500/30 bg-red-500/5" :
          "border-amber-500/30 bg-amber-500/5"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            {currentRun.model_verdict === "VALID" ? (
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
            ) : currentRun.model_verdict === "BLOCKED" ? (
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold text-foreground">
                Veredicto: {currentRun.model_verdict === "VALID" ? "Modelo Válido" :
                  currentRun.model_verdict === "BLOCKED" ? "Bloqueado — Datos Insuficientes" :
                  "No Fiable Aún"}
              </p>
              <p className="text-xs text-muted-foreground">
                {(currentRun.phase_results as any)?.phase_7?.verdict_explanation || ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No run yet */}
      {!currentRun && (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <Radar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-sm text-muted-foreground mb-4">
              No hay análisis de patrones para este proyecto. Inicia uno para detectar señales y oportunidades.
            </p>
            <Button onClick={() => setSetupOpen(true)} className="gap-2">
              <Radar className="w-4 h-4" /> Iniciar Detector de Patrones
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {currentRun && !isRunning && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (currentRun) {
              createRun({
                sector: currentRun.sector,
                geography: currentRun.geography || undefined,
                time_horizon: currentRun.time_horizon || undefined,
                business_objective: currentRun.business_objective || undefined,
              });
            }
          }} className="gap-1">
            <RefreshCw className="w-4 h-4" /> Reanalizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSetupOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Nuevo análisis
          </Button>
        </div>
      )}

      {/* Sub-tabs */}
      {currentRun && (
        <Tabs defaultValue="sources" className="w-full">
          <TabsList className="bg-muted/30 border border-border w-full justify-start overflow-x-auto">
            <TabsTrigger value="sources" className="gap-1 text-xs"><Database className="w-3 h-3" /> Fuentes ({sources.length})</TabsTrigger>
            <TabsTrigger value="quality" className="gap-1 text-xs"><Shield className="w-3 h-3" /> Quality Gate</TabsTrigger>
            <TabsTrigger value="layers" className="gap-1 text-xs"><Layers className="w-3 h-3" /> Análisis ({signals.length})</TabsTrigger>
            <TabsTrigger value="credibility" className="gap-1 text-xs"><Award className="w-3 h-3" /> Credibilidad</TabsTrigger>
            <TabsTrigger value="datasets" className="gap-1 text-xs"><FileSpreadsheet className="w-3 h-3" /> Datasets</TabsTrigger>
            <TabsTrigger value="backtest" className="gap-1 text-xs"><BarChart3 className="w-3 h-3" /> Backtesting</TabsTrigger>
          </TabsList>

          {/* SOURCES */}
          <TabsContent value="sources" className="mt-4 space-y-2">
             {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isRunning ? "Buscando fuentes..." : "Sin fuentes registradas"}
              </p>
            ) : sources.map(src => (
              <div key={src.id} className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{src.source_name}</p>
                    <Badge variant="outline" className="text-xs">{src.source_type}</Badge>
                    {src.status === "available" && (
                      <Badge className="text-xs bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20">Disponible</Badge>
                    )}
                    {src.status === "pending" && (
                      <Badge className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Pendiente</Badge>
                    )}
                    {src.status === "requires_agreement" && (
                      <Badge className="text-xs bg-muted text-muted-foreground border-border hover:bg-muted/80">Requiere acuerdo</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{src.data_type}</span>
                    {src.update_frequency && (
                      <span className="text-xs text-muted-foreground">• {src.update_frequency}</span>
                    )}
                    {src.coverage_period && (
                      <span className="text-xs text-muted-foreground">• {src.coverage_period}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs",
                    src.reliability_score >= 7 ? "text-green-400" :
                    src.reliability_score >= 5 ? "text-amber-400" : "text-red-400"
                  )}>
                    {src.reliability_score}/10
                  </Badge>
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* QUALITY GATE */}
          <TabsContent value="quality" className="mt-4">
            {currentRun.quality_gate ? (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Shield className="w-4 h-4" /> QUALITY GATE
                    <Badge variant="outline" className={cn("text-xs ml-auto",
                      currentRun.quality_gate.status === "PASS" ? "text-green-400 border-green-500/30" :
                      currentRun.quality_gate.status === "PASS_CONDITIONAL" ? "text-amber-400 border-amber-500/30" :
                      "text-red-400 border-red-500/30"
                    )}>
                      {currentRun.quality_gate.status === "PASS_CONDITIONAL" ? "⚠ CONDICIONAL" : currentRun.quality_gate.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">COBERTURA</p>
                      <div className="flex items-center gap-2">
                        <Progress value={currentRun.quality_gate.coverage_pct} className="h-1.5 flex-1" />
                        <span className="text-sm font-mono">{Math.round(currentRun.quality_gate.coverage_pct)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">FRESCURA</p>
                      <div className="flex items-center gap-2">
                        <Progress value={currentRun.quality_gate.freshness_pct} className="h-1.5 flex-1" />
                        <span className="text-sm font-mono">{Math.round(currentRun.quality_gate.freshness_pct)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">DIVERSIDAD FUENTES</p>
                      <p className="text-lg font-bold text-foreground">{currentRun.quality_gate.source_diversity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">FIABILIDAD MEDIA</p>
                      <p className="text-lg font-bold text-foreground">{currentRun.quality_gate.avg_reliability_score}/10</p>
                    </div>
                  </div>
                  {currentRun.quality_gate.status === "PASS_CONDITIONAL" && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-xs font-mono text-amber-400 mb-1">PASS CONDICIONAL</p>
                      <p className="text-xs text-amber-300">
                        {(currentRun.quality_gate as any).note || "Fuentes identificadas pero no conectadas. Cap de confianza: 60%"}
                      </p>
                      {(currentRun.quality_gate as any).pending_sources_count > 0 && (
                        <p className="text-xs text-amber-300 mt-1">
                          📋 {(currentRun.quality_gate as any).pending_sources_count} fuentes pendientes de verificación
                        </p>
                      )}
                    </div>
                  )}
                  {currentRun.quality_gate.gap_analysis?.length > 0 && (
                     <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                       <p className="text-xs font-mono text-red-400 mb-1">BRECHAS DETECTADAS</p>
                       {currentRun.quality_gate.gap_analysis.map((gap: string, i: number) => (
                         <p key={i} className="text-xs text-red-300">• {gap}</p>
                       ))}
                     </div>
                   )}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isRunning ? "Evaluando calidad..." : "Quality Gate no ejecutado aún"}
              </p>
            )}
          </TabsContent>

          {/* LAYERS / SIGNALS */}
          <TabsContent value="layers" className="mt-4 space-y-3">
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isRunning ? "Detectando patrones..." : "Sin patrones detectados"}
              </p>
            ) : (
              Object.entries(signalsByLayer).sort(([a], [b]) => Number(a) - Number(b)).map(([layerId, layerSignals]) => (
                <Collapsible key={layerId} defaultOpen={Number(layerId) <= 2}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl border border-border bg-card hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", layerColors[Number(layerId)] || "")}>
                        Capa {layerId}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{layerSignals[0]?.layer_name}</span>
                      <span className="text-xs text-muted-foreground">({layerSignals.length} señales)</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2 pl-2">
                    {layerSignals.map(sig => (
                      <div key={sig.id} className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{sig.signal_name}</p>
                          {trendIcon(sig.trend)}
                          {impactBadge(sig.impact)}
                          <Badge variant="outline" className="text-xs">
                            {Math.round(sig.confidence * 100)}% conf
                          </Badge>
                          {sig.p_value != null && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Info className="w-2.5 h-2.5" /> p≈{sig.p_value.toFixed(3)}
                            </Badge>
                          )}
                        </div>
                        {sig.description && (
                          <p className="text-xs text-muted-foreground">{sig.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs">
                          {sig.devil_advocate_result && (
                            <span className={cn(
                              sig.devil_advocate_result === "validated" ? "text-green-400" :
                              sig.devil_advocate_result === "degraded" ? "text-amber-400" : "text-red-400"
                            )}>
                              🔍 {sig.devil_advocate_result}
                            </span>
                          )}
                          <span className="text-muted-foreground">📊 {sig.uncertainty_type}</span>
                          {sig.data_source && (
                            <span className="text-muted-foreground truncate">📁 {sig.data_source}</span>
                          )}
                        </div>
                        {sig.contradicting_evidence && (
                          <p className="text-xs text-amber-400/80 bg-amber-500/5 p-2 rounded">
                            ⚠️ Evidencia contraria: {sig.contradicting_evidence}
                          </p>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
            {signals.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Info className="w-3 h-3" />
                <span>Estimaciones de la IA — No son cálculos estadísticos reales</span>
              </div>
            )}
          </TabsContent>

          {/* CREDIBILITY ENGINE */}
          <TabsContent value="credibility" className="mt-4 space-y-4">
            {(() => {
              const dashOutput = currentRun?.dashboard_output as any;
              const ce = dashOutput?.credibility_engine;
              const lm = dashOutput?.learning_metrics;
              const regime = ce?.regime_detected || lm?.regime_detected || "normal";

              const alphaSignals = credibility.filter(c => c.signal_class === "Alpha");
              const betaSignals = credibility.filter(c => c.signal_class === "Beta");
              const fragileSignals = credibility.filter(c => c.signal_class === "Fragile");
              const noiseSignals = credibility.filter(c => c.signal_class === "Noise");

              if (credibility.length === 0 && !ce) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {isRunning ? "Evaluando credibilidad de señales..." : "Sin datos de credibilidad disponibles"}
                  </p>
                );
              }

              return (
                <>
                  {/* Regime Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">RÉGIMEN DETECTADO:</span>
                    <Badge variant="outline" className={cn("text-xs", regimeBadgeColors[regime] || regimeBadgeColors.normal)}>
                      {regime.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                  </div>

                  {/* 4 Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="border-green-500/20 bg-green-500/5">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-green-400 font-mono">🟢 ALPHA</p>
                        <p className="text-2xl font-bold text-green-400">{ce?.active_alpha_signals || alphaSignals.length}</p>
                        <p className="text-xs text-muted-foreground">Automatizables</p>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-500/20 bg-amber-500/5">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-amber-400 font-mono">🟡 BETA</p>
                        <p className="text-2xl font-bold text-amber-400">{ce?.active_beta_signals || betaSignals.length}</p>
                        <p className="text-xs text-muted-foreground">Supervisión</p>
                      </CardContent>
                    </Card>
                    <Card className="border-orange-500/20 bg-orange-500/5">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-orange-400 font-mono">🟠 FRÁGIL</p>
                        <p className="text-2xl font-bold text-orange-400">{ce?.fragile_in_quarantine || fragileSignals.length}</p>
                        <p className="text-xs text-muted-foreground">Cuarentena</p>
                      </CardContent>
                    </Card>
                    <Card className="border-red-500/20 bg-red-500/5">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-red-400 font-mono">🔴 RUIDO</p>
                        <p className="text-2xl font-bold text-red-400">{ce?.noise_filtered || noiseSignals.length}</p>
                        <p className="text-xs text-muted-foreground">Filtrado</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Credibility Table */}
                  {credibility.length > 0 && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono flex items-center gap-2">
                          <Award className="w-4 h-4" /> MATRIZ DE CREDIBILIDAD
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {credibility.map(cred => {
                          const signalName = signals.find(s => s.id === cred.signal_id)?.signal_name || "Señal";
                          const cls = credibilityClassColors[cred.signal_class] || credibilityClassColors.Noise;
                          return (
                            <div key={cred.id} className={cn("p-3 rounded-lg border", cls.border, cls.bg)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={cn("text-xs font-mono", cls.text, cls.border)}>
                                    {cred.signal_class}
                                  </Badge>
                                  <span className="text-sm font-medium text-foreground">{signalName}</span>
                                </div>
                                <span className="text-sm font-mono font-bold text-foreground">
                                  {(cred.final_credibility_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                                <div>
                                  <p className="font-mono">Estabilidad</p>
                                  <p className="text-foreground">{((cred.temporal_stability_score || 0) * 100).toFixed(0)}%</p>
                                </div>
                                <div>
                                  <p className="font-mono">Replicación</p>
                                  <p className="text-foreground">{((cred.cross_replication_score || 0) * 100).toFixed(0)}%</p>
                                </div>
                                <div>
                                  <p className="font-mono">Anticipación</p>
                                  <p className="text-foreground">{cred.anticipation_days || 0}d</p>
                                </div>
                                <div>
                                  <p className="font-mono">S/R Ratio</p>
                                  <p className="text-foreground">{((cred.signal_to_noise_ratio || 0) * 100).toFixed(0)}%</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* Learning Metrics */}
                  {lm && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono flex items-center gap-2">
                          <Eye className="w-4 h-4" /> MÉTRICAS DE APRENDIZAJE
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground font-mono">ACIERTO ACTUAL</p>
                            <p className="text-lg font-bold text-foreground">{((lm.accuracy_current || 0) * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-mono">DISTANCIA ÓPTIMO</p>
                            <p className="text-lg font-bold text-foreground">{lm.distance_to_optimal || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-mono">PATRONES DESCUBIERTOS</p>
                            <p className="text-lg font-bold text-foreground">{discoveries.length || lm.patterns_discovered_this_month || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-mono">HIPÓTESIS CONFIRMADAS</p>
                            <p className="text-lg font-bold text-foreground">{lm.hypotheses_confirmed || 0}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 p-2">
                          <Info className="w-3 h-3" />
                          <span>Métricas iniciales (Modo 1 teórico). Se actualizarán con datos reales del cliente.</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>

          {/* DATASETS */}
          <TabsContent value="datasets" className="mt-4">
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground mb-2">
                  Sube datasets propios (CSV, Excel, JSON) para mejorar la confianza del análisis.
                </p>
                <p className="text-xs text-muted-foreground">
                  Sin datos propios, el cap de confianza máxima es 70%.
                </p>
                <Button variant="outline" size="sm" className="mt-4 gap-1" disabled>
                  <Plus className="w-4 h-4" /> Subir dataset (próximamente)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BACKTESTING */}
          <TabsContent value="backtest" className="mt-4 space-y-4">
            {backtest ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="border-border bg-card">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">WIN RATE</p>
                      <p className="text-xl font-bold text-foreground">{backtest.win_rate_pct?.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">UPLIFT vs BASELINE</p>
                      <p className={cn("text-xl font-bold",
                        (backtest.uplift_vs_baseline_pct || 0) > 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {(backtest.uplift_vs_baseline_pct || 0) > 0 ? "+" : ""}{backtest.uplift_vs_baseline_pct?.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">PRECISIÓN</p>
                      <p className="text-xl font-bold text-foreground">{backtest.precision_pct?.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-card">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">ANTICIPACIÓN</p>
                      <p className="text-xl font-bold text-foreground">{backtest.avg_anticipation_days?.toFixed(0)}d</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Complexity justified */}
                <Card className={cn("border", backtest.complexity_justified ? "border-green-500/30" : "border-amber-500/30")}>
                  <CardContent className="p-3 flex items-center gap-2">
                    {backtest.complexity_justified ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    )}
                    <span className="text-sm text-foreground">
                      {backtest.complexity_justified
                        ? "Complejidad justificada — supera significativamente al modelo naive"
                        : "Complejidad NO justificada — mejora marginal sobre modelo naive"}
                    </span>
                  </CardContent>
                </Card>

                {/* Retrospective cases */}
                {backtest.retrospective_cases && Array.isArray(backtest.retrospective_cases) && (
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-mono text-muted-foreground">CASOS RETROSPECTIVOS</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {backtest.retrospective_cases.map((c: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                          <span className={cn("text-lg", c.detected ? "text-green-400" : "text-red-400")}>
                            {c.detected ? "✓" : "✕"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{c.event}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.detected ? `${c.days_in_advance}d antes` : "No detectado"} • {c.signal_used}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                  <Info className="w-3 h-3" />
                  <span>⚠️ Métricas ESTIMADAS por IA — No son cálculos reales con datos históricos</span>
                </div>

                {/* ═══ ECONOMIC IMPACT SECTION ═══ */}
                {ecoBacktest && (
                  <div className="space-y-4 mt-6">
                    <div className="flex items-center gap-2 border-t border-border pt-4">
                      <Euro className="w-5 h-5 text-primary" />
                      <h3 className="text-sm font-mono font-bold text-foreground">IMPACTO ECONÓMICO</h3>
                    </div>

                    {/* 4 Economic Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card className="border-green-500/20 bg-green-500/5">
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-green-400 font-mono">INGRESOS PROTEGIDOS</p>
                          <p className="text-xl font-bold text-green-400">€{(ecoBacktest.gross_revenue_protected || 0).toLocaleString()}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-amber-400 font-mono">COSTE FALSAS ALARMAS</p>
                          <p className="text-xl font-bold text-amber-400">€{(ecoBacktest.capital_tied_up_cost || 0).toLocaleString()}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-red-500/20 bg-red-500/5">
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-red-400 font-mono">PÉRDIDAS NO PREVENIDAS</p>
                          <p className="text-xl font-bold text-red-400">€{(ecoBacktest.unprevented_losses || 0).toLocaleString()}</p>
                        </CardContent>
                      </Card>
                      <Card className={cn("border", (ecoBacktest.net_economic_impact || 0) >= 0 ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5")}>
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-foreground font-mono">IMPACTO NETO</p>
                          <p className={cn("text-xl font-bold", (ecoBacktest.net_economic_impact || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                            €{(ecoBacktest.net_economic_impact || 0).toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* ROI Card */}
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-mono">ROI</p>
                            <p className="text-2xl font-bold text-primary">
                              Por cada €1 invertido, €{(ecoBacktest.roi_multiplier || 0).toFixed(1)} de retorno
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground font-mono">PAYBACK</p>
                            <p className="text-lg font-bold text-foreground">{ecoBacktest.payback_period_days || 0} días</p>
                          </div>
                        </div>
                        {(() => {
                          const assumptions = ecoBacktest.assumptions as any;
                          const unitName = assumptions?.unit_name || "unidad";
                          const totalUnits = ecoBacktest.total_pharmacies || assumptions?.default_units || 1;
                          const perUnitImpact = ecoBacktest.per_pharmacy_impact || 0;
                          const showNetwork = totalUnits > 1;
                          return (
                            <div className={cn("gap-4 mt-3 pt-3 border-t border-border/50", showNetwork ? "grid grid-cols-2" : "")}>
                              <div>
                                <p className="text-xs text-muted-foreground font-mono">POR {unitName.toUpperCase()}</p>
                                <p className="text-sm font-bold text-foreground">€{perUnitImpact.toLocaleString()}/mes</p>
                              </div>
                              {showNetwork && (
                                <div>
                                  <p className="text-xs text-muted-foreground font-mono">TOTAL RED (×{totalUnits.toLocaleString()})</p>
                                  <p className="text-sm font-bold text-foreground">€{(perUnitImpact * totalUnits).toLocaleString()}/mes</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    {/* Event Breakdown */}
                    {ecoBacktest.event_breakdown && ecoBacktest.event_breakdown.length > 0 && (
                      <Card className="border-border bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono flex items-center gap-2">
                            <Target className="w-4 h-4" /> DESGLOSE POR EVENTO
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Evento</TableHead>
                                <TableHead className="text-xs">Tipo</TableHead>
                                <TableHead className="text-xs text-right">Impacto €</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ecoBacktest.event_breakdown.map((ev: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">
                                    <span className={ev.prediction_correct ? "text-green-400" : "text-red-400"}>
                                      {ev.prediction_correct ? "✓" : "✕"}
                                    </span>{" "}
                                    {ev.event}
                                    {ev.anticipation_days > 0 && <span className="text-muted-foreground ml-1">({ev.anticipation_days}d)</span>}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className={cn("text-xs",
                                      ev.impact_type === "revenue_protected" ? "text-green-400" :
                                      ev.impact_type === "capital_cost" ? "text-amber-400" : "text-red-400"
                                    )}>
                                      {ev.impact_type === "revenue_protected" ? "Protegido" :
                                       ev.impact_type === "capital_cost" ? "Coste" : "Pérdida"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className={cn("text-xs text-right font-mono",
                                    ev.impact_type === "revenue_protected" ? "text-green-400" :
                                    ev.impact_type === "capital_cost" ? "text-amber-400" : "text-red-400"
                                  )}>
                                    {ev.impact_type === "revenue_protected" ? "+" : "-"}€{Math.abs(ev.economic_impact_eur || 0).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Error Intelligence */}
                    {ecoBacktest.error_intelligence && ecoBacktest.error_intelligence.length > 0 && (
                      <Card className="border-border bg-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" /> OPORTUNIDADES DE MEJORA
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {ecoBacktest.error_intelligence.map((ei: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-2">
                              <p className="text-sm font-medium text-foreground">{ei.missed_event}</p>
                              <p className="text-xs text-muted-foreground">{ei.root_cause}</p>
                              <div className="flex flex-wrap gap-2">
                                {(ei.proposed_sources || []).map((src: string, j: number) => (
                                  <Badge key={j} variant="outline" className="text-xs">{src}</Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Coste: <strong className="text-foreground">{ei.integration_cost}</strong></span>
                                <span>Uplift: <strong className="text-foreground">{ei.expected_uplift}</strong></span>
                                <span>Prioridad: <strong className="text-foreground">{((ei.priority || 0) * 100).toFixed(0)}%</strong></span>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Validation Plans */}
                    {(() => {
                      const vp = (currentRun?.phase_results as any)?.economic_backtesting?.validation_plans;
                      if (!vp || vp.length === 0) return null;
                      return (
                        <Card className="border-border bg-card">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-mono flex items-center gap-2">
                              <Shield className="w-4 h-4" /> PLANES DE VALIDACIÓN
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {vp.map((plan: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg border border-border/50 bg-card/50 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-foreground">{plan.signal_name}</p>
                                  <Badge variant="outline" className={cn("text-xs",
                                    plan.recommendation === "invest" ? "text-green-400 border-green-500/30" : "text-amber-400 border-amber-500/30"
                                  )}>
                                    {plan.recommendation === "invest" ? "✓ Invertir" : "⏸ Diferir"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">📊 Datos: {plan.data_needed}</p>
                                <p className="text-xs text-muted-foreground">📍 Fuente: {plan.where_to_get}</p>
                                <p className="text-xs text-muted-foreground">💡 Impacto: {plan.estimated_impact}</p>
                                <p className="text-xs text-muted-foreground">💰 Coste: {plan.integration_cost}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {/* Disclaimer */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/20 rounded-lg">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      <span>Estimaciones de IA — margen conservador del {ecoBacktest.margin_used_pct || 30}%. Bonus fidelización y daño reputacional desactivados.</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isRunning ? "Estimando backtesting..." : "Sin resultados de backtesting"}
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Intent Review screen */}
      {reviewIntent && reviewParams && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-start justify-center p-4 pt-8 overflow-hidden">
          <div className="w-full max-w-2xl max-h-full flex flex-col">
            <PatternIntentReview
              intent={reviewIntent}
              originalParams={reviewParams}
              loading={confirmLoading}
              onBack={() => {
                setReviewIntent(null);
                setReviewParams(null);
                setSetupOpen(true);
              }}
              onConfirm={async (expandedObjective) => {
                setConfirmLoading(true);
                await createRun({
                  sector: reviewParams.sector,
                  geography: reviewParams.geography,
                  time_horizon: reviewParams.time_horizon,
                  business_objective: expandedObjective,
                });
                setConfirmLoading(false);
                setReviewIntent(null);
                setReviewParams(null);
              }}
            />
          </div>
        </div>
      )}

      <PatternDetectorSetup
        open={setupOpen}
        onOpenChange={setSetupOpen}
        projectId={projectId}
        onTranslate={async (params) => {
          const result = await translateIntent(params);
          if (result) {
            setReviewParams(params);
            setReviewIntent(result);
          }
        }}
      />
    </div>
  );
};
