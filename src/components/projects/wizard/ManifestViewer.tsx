import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Layers, AlertTriangle, CheckCircle2, Info, Lock, Shield, Server } from "lucide-react";

interface ManifestModule {
  module_id?: string;
  module_name?: string;
  module_type?: string;
  layer?: string;
  materialization_target?: string;
  execution_mode?: string;
  sensitivity_zone?: string;
  automation_level?: string;
  requires_human_approval?: boolean;
  phase?: string;
  compliance?: {
    eu_ai_act_risk_level?: string;
    eu_ai_act_annex_iii_domain?: string | null;
    requires_isolated_model?: boolean;
    isolation_priority?: string;
    data_residency?: string;
    human_oversight_level?: string;
    explainability_required?: boolean;
    decision_logging_required?: boolean;
  };
  [key: string]: unknown;
}

interface ManifestLayer {
  active?: boolean;
  modules?: ManifestModule[];
  [key: string]: unknown;
}

interface ValidationResult {
  errors?: { message: string }[];
  warnings?: { message: string }[];
  advice?: { message: string }[];
}

interface InfrastructureSizing {
  deployment_phase?: string;
  requires_isolated_infrastructure?: boolean;
  isolation_modules_count?: number;
  hardware_recommendation?: Array<{
    phase?: string; config?: string; gpu?: string;
    vram_gb?: number; estimated_cost_eur?: string;
  }>;
  llm_recommendation?: Array<{
    model?: string; parameters?: string; use_case?: string;
  }>;
  scale_path_summary?: string;
}

interface Props {
  manifest: Record<string, unknown>;
}

const LAYER_CONFIG: { key: string; label: string; color: string }[] = [
  { key: "A_knowledge", label: "A — Knowledge", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { key: "B_action", label: "B — Action", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { key: "C_pattern", label: "C — Pattern", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { key: "D_executive_cognition", label: "D — Executive", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { key: "E_improvement", label: "E — Improvement", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
];

const RISK_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  limited: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  minimal: "bg-green-500/20 text-green-400 border-green-500/30",
  unacceptable: "bg-red-700/30 text-red-300 border-red-700/50",
};

type TabKey = "layers" | "compliance";

export function ManifestViewer({ manifest }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("layers");

  const layers = (manifest.layers || {}) as Record<string, ManifestLayer>;
  const validation = manifest.validation as ValidationResult | undefined;
  const allModules = (manifest.modules || []) as ManifestModule[];
  const infraSizing = manifest.infrastructure_sizing as InfrastructureSizing | undefined;

  const errorCount = validation?.errors?.length || 0;
  const warningCount = validation?.warnings?.length || 0;
  const adviceCount = validation?.advice?.length || 0;

  const activeLayers = LAYER_CONFIG.filter(l => {
    const layer = layers[l.key];
    return layer?.active !== false && (layer?.modules?.length || 0) > 0;
  });

  const totalModules = LAYER_CONFIG.reduce((sum, l) => {
    return sum + ((layers[l.key]?.modules?.length) || 0);
  }, 0);

  // Compliance stats
  const modulesWithCompliance = allModules.filter(m => m.compliance);
  const highRiskModules = modulesWithCompliance.filter(m => m.compliance?.eu_ai_act_risk_level === "high");
  const isolatedModules = modulesWithCompliance.filter(m => m.compliance?.requires_isolated_model);
  const hasCompliance = modulesWithCompliance.length > 0 || infraSizing;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Architecture Manifest</p>
                  <p className="text-xs text-muted-foreground">
                    {totalModules} módulos · {activeLayers.length} capas activas
                    {hasCompliance && ` · ${highRiskModules.length} alto riesgo`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-5">
                    {errorCount} errores
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-400">
                    {warningCount} warnings
                  </Badge>
                )}
                {errorCount === 0 && warningCount === 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 border-primary/50 text-primary">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                  </Badge>
                )}
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-3">
            {/* Tab switcher */}
            {hasCompliance && (
              <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("layers")}
                  className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${activeTab === "layers" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Layers className="h-3 w-3 inline mr-1" />Capas
                </button>
                <button
                  onClick={() => setActiveTab("compliance")}
                  className={`flex-1 text-xs py-1.5 px-3 rounded-md transition-colors ${activeTab === "compliance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Shield className="h-3 w-3 inline mr-1" />Compliance
                </button>
              </div>
            )}

            {/* Layers tab */}
            {activeTab === "layers" && (
              <>
                {/* Layer badges */}
                <div className="flex flex-wrap gap-1.5">
                  {LAYER_CONFIG.map(l => {
                    const layer = layers[l.key];
                    const moduleCount = layer?.modules?.length || 0;
                    const isActive = layer?.active !== false && moduleCount > 0;
                    return (
                      <Badge
                        key={l.key}
                        variant="outline"
                        className={`text-[10px] cursor-pointer transition-colors ${isActive ? l.color : "opacity-40"}`}
                        onClick={() => isActive && setExpandedLayer(expandedLayer === l.key ? null : l.key)}
                      >
                        {l.label} ({moduleCount})
                      </Badge>
                    );
                  })}
                </div>

                {/* Expanded layer modules */}
                {expandedLayer && layers[expandedLayer]?.modules && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {LAYER_CONFIG.find(l => l.key === expandedLayer)?.label}
                    </p>
                    {layers[expandedLayer].modules!.map((mod, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/50">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{mod.module_id || `M${i}`}</span>
                          <span className="text-foreground">{mod.module_name || "Sin nombre"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {mod.requires_human_approval && (
                            <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                          )}
                          {mod.compliance?.eu_ai_act_risk_level && mod.compliance.eu_ai_act_risk_level !== "minimal" && (
                            <Badge variant="outline" className={`text-[9px] h-4 ${RISK_COLORS[mod.compliance.eu_ai_act_risk_level] || ""}`}>
                              {mod.compliance.eu_ai_act_risk_level}
                            </Badge>
                          )}
                          {mod.compliance?.requires_isolated_model && (
                            <Shield className="h-3 w-3 text-red-400 shrink-0" />
                          )}
                          {mod.sensitivity_zone && mod.sensitivity_zone !== "low" && (
                            <Badge variant="outline" className="text-[9px] h-4 border-red-500/40 text-red-400">{mod.sensitivity_zone}</Badge>
                          )}
                          {mod.automation_level && (
                            <Badge variant="outline" className="text-[9px] h-4">{mod.automation_level}</Badge>
                          )}
                          {mod.execution_mode && (
                            <Badge variant="outline" className="text-[9px] h-4">{mod.execution_mode}</Badge>
                          )}
                          {mod.materialization_target && (
                            <Badge variant="outline" className="text-[9px] h-4">{mod.materialization_target.replace("expertforge_", "")}</Badge>
                          )}
                          {mod.phase && (
                            <Badge variant="outline" className="text-[9px] h-4">{mod.phase}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Compliance tab */}
            {activeTab === "compliance" && hasCompliance && (
              <div className="space-y-3">
                {/* Risk summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{highRiskModules.length}</p>
                    <p className="text-[10px] text-red-400">Alto riesgo</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{isolatedModules.length}</p>
                    <p className="text-[10px] text-amber-400">Requieren aislamiento</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {modulesWithCompliance.filter(m => m.compliance?.eu_ai_act_risk_level === "minimal").length}
                    </p>
                    <p className="text-[10px] text-green-400">Riesgo mínimo</p>
                  </div>
                </div>

                {/* Per-module compliance */}
                {modulesWithCompliance.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Clasificación por módulo</p>
                    {modulesWithCompliance.map((mod, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/50">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{mod.module_id}</span>
                          <span className="text-foreground truncate max-w-[120px]">{mod.module_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[9px] h-4 ${RISK_COLORS[mod.compliance?.eu_ai_act_risk_level || "minimal"] || ""}`}>
                            {mod.compliance?.eu_ai_act_risk_level || "minimal"}
                          </Badge>
                          {mod.compliance?.isolation_priority && mod.compliance.isolation_priority !== "not_needed" && (
                            <Badge variant="outline" className="text-[9px] h-4 border-amber-500/40 text-amber-400">
                              <Shield className="h-2.5 w-2.5 mr-0.5" />{mod.compliance.isolation_priority}
                            </Badge>
                          )}
                          {mod.compliance?.data_residency && mod.compliance.data_residency !== "any" && (
                            <Badge variant="outline" className="text-[9px] h-4">{mod.compliance.data_residency}</Badge>
                          )}
                          {mod.compliance?.human_oversight_level && mod.compliance.human_oversight_level !== "full_autonomous" && (
                            <Badge variant="outline" className="text-[9px] h-4">{mod.compliance.human_oversight_level.replace(/_/g, " ")}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Infrastructure sizing summary */}
                {infraSizing && infraSizing.requires_isolated_infrastructure && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground">Infraestructura On-Premise</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Fase: {infraSizing.deployment_phase || "beta"} · {infraSizing.isolation_modules_count || 0} módulos aislados
                    </p>
                    {infraSizing.hardware_recommendation && infraSizing.hardware_recommendation.length > 0 && (
                      <div className="space-y-1">
                        {infraSizing.hardware_recommendation.map((hw, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                            <span className="text-foreground">{hw.phase}: {hw.gpu} ({hw.vram_gb}GB)</span>
                            <span className="text-muted-foreground">{hw.estimated_cost_eur}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {infraSizing.scale_path_summary && (
                      <p className="text-[10px] text-muted-foreground italic">{infraSizing.scale_path_summary}</p>
                    )}
                  </div>
                )}

                {!infraSizing?.requires_isolated_infrastructure && modulesWithCompliance.length > 0 && isolatedModules.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded-lg p-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>No se requiere infraestructura on-premise. APIs cloud recomendadas.</span>
                  </div>
                )}
              </div>
            )}

            {/* Validation issues */}
            {(errorCount > 0 || warningCount > 0 || adviceCount > 0) && (
              <div className="space-y-1">
                {validation?.errors?.map((e, i) => (
                  <div key={`e${i}`} className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{e.message}</span>
                  </div>
                ))}
                {validation?.warnings?.map((w, i) => (
                  <div key={`w${i}`} className="flex items-start gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
                {validation?.advice?.map((a, i) => (
                  <div key={`a${i}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
