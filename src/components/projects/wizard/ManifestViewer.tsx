import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Layers, AlertTriangle, CheckCircle2, Info, Lock } from "lucide-react";

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

export function ManifestViewer({ manifest }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);

  const layers = (manifest.layers || {}) as Record<string, ManifestLayer>;
  const validation = manifest.validation as ValidationResult | undefined;

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
