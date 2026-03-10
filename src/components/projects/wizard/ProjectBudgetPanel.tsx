import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Calculator, Loader2, TrendingUp, Server, Package, Star, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BudgetData {
  development: {
    phases: Array<{ name: string; description?: string; hours: number; cost_eur: number }>;
    total_hours: number;
    hourly_rate_eur: number;
    total_development_eur: number;
    your_cost_eur?: number;
    margin_pct?: number;
  };
  recurring_monthly: {
    items?: Array<{ name: string; cost_eur: number; notes?: string }>;
    hosting: number;
    ai_apis: number;
    maintenance_hours?: number;
    maintenance_eur?: number;
    total_monthly_eur: number;
  };
  monetization_models: Array<{
    name: string;
    description: string;
    setup_price_eur?: string;
    monthly_price_eur?: string;
    price_range?: string;
    your_margin_pct?: number;
    pros: string[];
    cons: string[];
    best_for?: string;
  }>;
  pricing_notes?: string;
  risk_factors?: string[];
  recommended_model?: string;
}

interface ProjectBudgetPanelProps {
  projectId: string;
  budgetData: BudgetData | null;
  generating: boolean;
  onGenerate: () => Promise<void>;
}

export const ProjectBudgetPanel = ({
  projectId,
  budgetData,
  generating,
  onGenerate,
}: ProjectBudgetPanelProps) => {
  return (
    <CollapsibleCard
      id="budget-internal"
      title="Estimación de Presupuesto"
      icon={<Calculator className="w-4 h-4 text-primary" />}
      badge={
        <Badge variant="outline" className="text-[10px] px-2 py-0 border-amber-500/30 text-amber-600 bg-amber-500/5">
          USO INTERNO
        </Badge>
      }
    >
      <div className="p-4 space-y-4">
        {!budgetData && !generating && (
          <div className="text-center py-6 space-y-3">
            <Calculator className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Genera una estimación de presupuesto realista y modelos de monetización para este proyecto.
            </p>
            <Button onClick={onGenerate} className="gap-2">
              <Calculator className="w-4 h-4" />
              Generar Estimación
            </Button>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analizando proyecto y calculando presupuesto...</p>
          </div>
        )}

        {budgetData && !generating && (
          <div className="space-y-5">
            {/* Development costs */}
            {budgetData.development && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Package className="w-4 h-4 text-primary" />
                  Costes de Desarrollo
                </h4>
                <Card className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    {budgetData.development.phases?.map((phase, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-foreground">{phase.name}</span>
                          {phase.description && (
                            <p className="text-xs text-muted-foreground">{phase.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-foreground font-medium">€{(phase.cost_eur ?? 0).toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground ml-1">({phase.hours ?? 0}h)</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-border/50 pt-2 flex justify-between text-sm font-semibold">
                      <span>Total desarrollo</span>
                      <span className="text-primary">€{(budgetData.development.total_development_eur ?? 0).toLocaleString()}</span>
                    </div>
                    {budgetData.development.your_cost_eur != null && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Tu coste real</span>
                        <span>€{budgetData.development.your_cost_eur.toLocaleString()} ({budgetData.development.margin_pct ?? 0}% margen)</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Tarifa: €{budgetData.development.hourly_rate_eur ?? 0}/h · {budgetData.development.total_hours ?? 0}h totales
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recurring costs */}
            {budgetData.recurring_monthly && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Server className="w-4 h-4 text-primary" />
                  Costes Recurrentes (mensual)
                </h4>
                <Card className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    {budgetData.recurring_monthly.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-foreground">{item.name}</span>
                          {item.notes && <span className="text-xs text-muted-foreground ml-1">— {item.notes}</span>}
                        </div>
                        <span className="text-foreground font-medium shrink-0">€{item.cost_eur ?? 0}/mes</span>
                      </div>
                    ))}
                    {!budgetData.recurring_monthly.items && (
                      <>
                        {budgetData.recurring_monthly.hosting != null && (
                          <div className="flex justify-between text-sm">
                            <span>Hosting</span>
                            <span>€{budgetData.recurring_monthly.hosting}/mes</span>
                          </div>
                        )}
                        {budgetData.recurring_monthly.ai_apis != null && (
                          <div className="flex justify-between text-sm">
                            <span>APIs IA</span>
                            <span>€{budgetData.recurring_monthly.ai_apis}/mes</span>
                          </div>
                        )}
                      </>
                    )}
                    {budgetData.recurring_monthly.maintenance_eur != null && (
                      <div className="flex justify-between text-sm">
                        <span>Mantenimiento ({budgetData.recurring_monthly.maintenance_hours ?? 0}h)</span>
                        <span>€{budgetData.recurring_monthly.maintenance_eur}/mes</span>
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-2 flex justify-between text-sm font-semibold">
                      <span>Total mensual</span>
                      <span className="text-primary">€{(budgetData.recurring_monthly.total_monthly_eur ?? 0)}/mes</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Monetization models */}
            {budgetData.monetization_models && budgetData.monetization_models.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Modelos de Monetización
                </h4>
                <div className="grid gap-3">
                  {budgetData.monetization_models.map((model, i) => {
                    const isRecommended = budgetData.recommended_model === model.name;
                    return (
                      <Card key={i} className={`border-border/50 ${isRecommended ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{model.name}</span>
                                {isRecommended && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                                    <Star className="w-3 h-3 mr-0.5" /> Recomendado
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs">
                            {model.setup_price_eur && (
                              <div>
                                <span className="text-muted-foreground">Setup:</span>
                                <span className="text-foreground font-medium ml-1">€{model.setup_price_eur}</span>
                              </div>
                            )}
                            {model.monthly_price_eur && (
                              <div>
                                <span className="text-muted-foreground">Mensual:</span>
                                <span className="text-foreground font-medium ml-1">€{model.monthly_price_eur}</span>
                              </div>
                            )}
                            {model.price_range && !model.setup_price_eur && (
                              <div>
                                <span className="text-muted-foreground">Precio:</span>
                                <span className="text-foreground font-medium ml-1">{model.price_range}</span>
                              </div>
                            )}
                            {model.your_margin_pct != null && (
                              <div>
                                <span className="text-muted-foreground">Margen:</span>
                                <span className="text-foreground font-medium ml-1">{model.your_margin_pct}%</span>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {model.pros && model.pros.length > 0 && (
                              <div>
                                <span className="text-green-600 font-medium">Pros:</span>
                                <ul className="mt-0.5 space-y-0.5">
                                  {model.pros.map((p, j) => (
                                    <li key={j} className="text-muted-foreground">+ {p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {model.cons && model.cons.length > 0 && (
                              <div>
                                <span className="text-red-500 font-medium">Contras:</span>
                                <ul className="mt-0.5 space-y-0.5">
                                  {model.cons.map((c, j) => (
                                    <li key={j} className="text-muted-foreground">− {c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          {model.best_for && (
                            <p className="text-[10px] text-muted-foreground italic">Ideal para: {model.best_for}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Risk factors */}
            {budgetData.risk_factors && budgetData.risk_factors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Factores de Riesgo
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                  {budgetData.risk_factors.map((r, i) => (
                    <li key={i} className="list-disc">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {budgetData.pricing_notes && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/20 pl-3">
                {budgetData.pricing_notes}
              </p>
            )}

            {/* Regenerate */}
            <div className="pt-2 border-t border-border/30">
              <Button variant="outline" size="sm" onClick={onGenerate} className="gap-2 text-xs">
                <Calculator className="w-3 h-3" />
                Regenerar estimación
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
};
