import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Calculator, Loader2, TrendingUp, Server, Package, Star, AlertTriangle, Pencil, Save, X, Users, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { budgetToCommercialTermsV1 } from "@/lib/budgetToCommercialTerms";

const MONETIZATION_OPTIONS = [
  { id: "saas_subscription", label: "SaaS (suscripción mensual)", description: "Cobro recurrente mensual/anual al cliente por uso de la plataforma." },
  { id: "fixed_price_maintenance", label: "Desarrollo a medida + Mantenimiento", description: "El cliente paga el desarrollo completo y es propietario del sistema. Solo paga una cuota mensual por infraestructura y mantenimiento." },
  { id: "license_fee", label: "Licencia por unidad", description: "Coste de implementación inicial reducido + cuota mensual por cada licencia activa (ej: por camión, por sede, por equipo)." },
  { id: "revenue_share", label: "Revenue share / Comisión", description: "Porcentaje sobre ingresos o transacciones generadas por la plataforma." },
  { id: "per_user_seat", label: "Por usuario / Asiento", description: "Cobro por cada usuario activo o licencia de asiento." },
  { id: "freemium", label: "Freemium + Premium", description: "Versión gratuita limitada con upgrade de pago para funcionalidades avanzadas." },
  { id: "consulting_retainer", label: "Consultoría + Retainer", description: "Implementación como servicio consultivo con retainer mensual de soporte." },
  { id: "white_label", label: "White Label / Marca blanca", description: "Venta del producto para que el cliente lo comercialice con su marca." },
];

interface BudgetPhase {
  name: string;
  description?: string;
  hours: number;
  cost_eur: number;
}

interface RecurringItem {
  name: string;
  cost_eur: number;
  notes?: string;
}

interface BudgetData {
  development: {
    phases: BudgetPhase[];
    total_hours: number;
    hourly_rate_eur: number;
    total_development_eur: number;
    your_cost_eur?: number;
    margin_pct?: number;
  };
  recurring_monthly: {
    items?: RecurringItem[];
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
    visible_to_client?: boolean;
  }>;
  pricing_notes?: string;
  risk_factors?: string[];
  recommended_model?: string;
  implementation_override?: {
    mvp_weeks?: number;
    fast_follow_weeks?: number;
    start_date?: string;
    notes?: string;
  };
  consulting_retainer?: {
    enabled?: boolean;
    monthly_fee_eur?: number;
    monthly_hours?: number;
    discount_pct?: number;
    notes?: string;
  };
}

interface ProjectBudgetPanelProps {
  projectId: string;
  projectName?: string;
  company?: string;
  budgetData: BudgetData | null;
  generating: boolean;
  budgetStatus?: "pending" | "generated" | "editing" | "approved";
  onGenerate: (selectedModels: string[]) => Promise<void>;
  onBudgetUpdate?: (data: BudgetData) => void;
  onApprove?: () => Promise<void> | void;
}

export const ProjectBudgetPanel = ({
  projectId,
  projectName = "",
  company = "",
  budgetData,
  generating,
  budgetStatus = "pending",
  onGenerate,
  onBudgetUpdate,
  onApprove,
}: ProjectBudgetPanelProps) => {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<BudgetData | null>(null);
  const [approving, setApproving] = useState(false);
  // Vista global del panel: cliente oculta márgenes, costes internos, horas
  const [viewMode, setViewMode] = useState<'internal' | 'client'>('internal');
  const isClientView = viewMode === 'client';

  useEffect(() => {
    if (budgetData) {
      setEditData(structuredClone(budgetData));
    }
  }, [budgetData]);

  const toggleModel = (id: string) => {
    setSelectedModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    if (selectedModels.length === 0) return;
    onGenerate(selectedModels);
  };

  // ── Editing helpers ──
  const recalcDevelopment = useCallback((data: BudgetData): BudgetData => {
    const d = data.development;
    const totalHours = d.phases.reduce((s, p) => s + (p.hours || 0), 0);
    const totalDev = d.phases.reduce((s, p) => s + (p.cost_eur || 0), 0);
    return {
      ...data,
      development: {
        ...d,
        total_hours: totalHours,
        total_development_eur: totalDev,
        your_cost_eur: d.your_cost_eur != null ? Math.round(totalDev * (1 - (d.margin_pct || 0) / 100)) : undefined,
      },
    };
  }, []);

  const recalcRecurring = useCallback((data: BudgetData): BudgetData => {
    const r = data.recurring_monthly;
    const itemsTotal = r.items ? r.items.reduce((s, i) => s + (i.cost_eur || 0), 0) : (r.hosting || 0) + (r.ai_apis || 0);
    const maintenanceTotal = r.maintenance_eur || 0;
    return {
      ...data,
      recurring_monthly: { ...r, total_monthly_eur: itemsTotal + maintenanceTotal },
    };
  }, []);

  // ── Sync setup_price del modelo recomendado con total_development_eur ──
  // Devuelve el primer importe numérico del string ("13.500" o "13.000-15.000" → 13500).
  const parseFirstAmount = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const m = raw.match(/[\d.,]+/);
    if (!m) return null;
    const cleaned = m[0].replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };
  const formatAmount = (n: number): string =>
    Math.round(n).toLocaleString("es-ES", { useGrouping: true });

  const recommendedIdx = (data: BudgetData): number => {
    if (!data.monetization_models?.length) return -1;
    if (data.recommended_model) {
      const i = data.monetization_models.findIndex((m) => m.name === data.recommended_model);
      if (i >= 0) return i;
    }
    return 0;
  };

  /** ¿Está sincronizado el setup_price del modelo recomendado con total_development_eur? */
  const isSetupSynced = (data: BudgetData | null): boolean => {
    if (!data) return true;
    const dev = data.development?.total_development_eur;
    const idx = recommendedIdx(data);
    if (dev == null || idx < 0) return true;
    const setup = parseFirstAmount(data.monetization_models?.[idx]?.setup_price_eur);
    if (setup == null) return true; // sin importe → no aplicable
    // Tolerancia 1% para evitar parpadeo por redondeos.
    return Math.abs(setup - dev) <= Math.max(50, dev * 0.01);
  };

  /** Propaga total_development_eur al setup_price del modelo recomendado (mantiene rango si lo había). */
  const syncSetupWithDev = (data: BudgetData): BudgetData => {
    const dev = data.development?.total_development_eur;
    const idx = recommendedIdx(data);
    if (dev == null || idx < 0 || !data.monetization_models) return data;
    const models = [...data.monetization_models];
    const current = models[idx]?.setup_price_eur;
    const isRange = current && /[-–—]/.test(current);
    let next: string;
    if (isRange) {
      // Mantener proporción del rango original sobre el nuevo total.
      const parts = current.split(/[-–—]/).map((s) => parseFirstAmount(s)).filter((n): n is number => n != null);
      if (parts.length === 2 && parts[0] > 0) {
        const ratio = parts[1] / parts[0];
        next = `${formatAmount(dev)}-${formatAmount(dev * ratio)}`;
      } else {
        next = formatAmount(dev);
      }
    } else {
      next = formatAmount(dev);
    }
    models[idx] = { ...models[idx], setup_price_eur: next };
    return { ...data, monetization_models: models };
  };

  /** Aplica recalc desarrollo y, si estaba sincronizado, propaga al setup_price del modelo recomendado. */
  const applyDevChange = (data: BudgetData): BudgetData => {
    const wasSynced = isSetupSynced(editData);
    const next = recalcDevelopment(data);
    return wasSynced ? syncSetupWithDev(next) : next;
  };

  const updatePhaseHours = (idx: number, hours: number) => {
    if (!editData) return;
    const phases = [...editData.development.phases];
    const rate = editData.development.hourly_rate_eur || 0;
    phases[idx] = { ...phases[idx], hours, cost_eur: Math.round(hours * rate) };
    setEditData(applyDevChange({ ...editData, development: { ...editData.development, phases } }));
  };

  const updatePhaseCost = (idx: number, cost_eur: number) => {
    if (!editData) return;
    const phases = [...editData.development.phases];
    phases[idx] = { ...phases[idx], cost_eur };
    setEditData(applyDevChange({ ...editData, development: { ...editData.development, phases } }));
  };

  const updateHourlyRate = (rate: number) => {
    if (!editData) return;
    const phases = editData.development.phases.map(p => ({
      ...p,
      cost_eur: Math.round(p.hours * rate),
    }));
    setEditData(applyDevChange({
      ...editData,
      development: { ...editData.development, hourly_rate_eur: rate, phases },
    }));
  };

  const updateRecurringItem = (idx: number, cost_eur: number) => {
    if (!editData?.recurring_monthly.items) return;
    const items = [...editData.recurring_monthly.items];
    items[idx] = { ...items[idx], cost_eur };
    const next = recalcRecurring({ ...editData, recurring_monthly: { ...editData.recurring_monthly, items } });
    setEditData(next);
  };

  const updateMaintenanceHours = (hours: number) => {
    if (!editData) return;
    const rate = editData.development.hourly_rate_eur || 0;
    const next = recalcRecurring({
      ...editData,
      recurring_monthly: {
        ...editData.recurring_monthly,
        maintenance_hours: hours,
        maintenance_eur: Math.round(hours * rate),
      },
    });
    setEditData(next);
  };

  const handleSave = () => {
    if (!editData) return;
    onBudgetUpdate?.(editData);
    // Derivar commercial_terms_v1 y persistir en localStorage para que el
    // pipeline técnico (F7) pueda leerlo sin tocar el schema actual.
    try {
      const derived = budgetToCommercialTermsV1(editData);
      if (derived) {
        localStorage.setItem(
          `commercial_terms_v1:${projectId}`,
          JSON.stringify(derived)
        );
      }
    } catch (e) {
      console.warn("[ProjectBudgetPanel] failed to derive commercial_terms_v1", e);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    if (budgetData) setEditData(structuredClone(budgetData));
    setEditing(false);
  };

  // Handlers de export PDF eliminados: la propuesta cliente vive en el Paso 5.

  const displayData = editing ? editData : budgetData;

  return (
    <CollapsibleCard
      id="budget-internal"
      title="Paso 4 · Presupuesto y condiciones"
      icon={<Calculator className="w-4 h-4 text-primary" />}
      defaultOpen={true}
      badge={
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 text-primary bg-primary/5">
            {isClientView ? "VISTA CLIENTE" : "VISTA INTERNA"}
          </Badge>
          {budgetStatus === "approved" && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-emerald-500/40 text-emerald-600 bg-emerald-500/5">
              APROBADO
            </Badge>
          )}
          {budgetStatus === "editing" && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-amber-500/40 text-amber-600 bg-amber-500/5">
              EDITADO
            </Badge>
          )}
          {budgetStatus === "generated" && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-muted-foreground/30 text-muted-foreground bg-muted/30">
              GENERADO
            </Badge>
          )}
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* View mode toggle (global) */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
          <p className="text-xs text-muted-foreground">
            Cambia entre lo que ves tú y lo que verá el cliente.
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode('internal')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                viewMode === 'internal'
                  ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20 text-foreground"
                  : "border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              <EyeOff className="w-3 h-3" /> Vista interna
            </button>
            <button
              type="button"
              onClick={() => setViewMode('client')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                viewMode === 'client'
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 text-foreground"
                  : "border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              <Eye className="w-3 h-3" /> Vista cliente
            </button>
          </div>
        </div>
        {/* Monetization model selector */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <TrendingUp className="w-4 h-4 text-primary" />
            Modelos de Monetización
          </h4>
          <p className="text-xs text-muted-foreground">
            Selecciona los modelos de monetización que quieres evaluar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MONETIZATION_OPTIONS.map(opt => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedModels.includes(opt.id)
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <Checkbox
                  checked={selectedModels.includes(opt.id)}
                  onCheckedChange={() => toggleModel(opt.id)}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Generate button */}
        {!generating && (
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={selectedModels.length === 0} className="gap-2">
              <Calculator className="w-4 h-4" />
              {budgetData ? "Regenerar Presupuesto" : "Generar Presupuesto"}
            </Button>
            {selectedModels.length === 0 && (
              <span className="text-xs text-muted-foreground">Selecciona al menos un modelo</span>
            )}
            {selectedModels.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {selectedModels.length} modelo{selectedModels.length > 1 ? "s" : ""} seleccionado{selectedModels.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analizando proyecto y calculando presupuesto...</p>
          </div>
        )}

        {displayData && !generating && (
          <div className="space-y-5">
            {/* Edit + Approve toggles */}
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="text-xs text-muted-foreground">
                {budgetStatus === "approved"
                  ? "Presupuesto aprobado. Ya puedes generar la propuesta cliente."
                  : budgetStatus === "editing"
                  ? "Has editado el presupuesto. Apruébalo de nuevo para habilitar la propuesta."
                  : "Revisa, edita y aprueba el presupuesto para generar la propuesta cliente."}
              </div>
              <div className="flex gap-2">
                {!editing ? (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditing(true)}>
                      <Pencil className="w-3.5 h-3.5" /> Editar presupuesto
                    </Button>
                    {onApprove && budgetStatus !== "approved" && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={approving}
                        onClick={async () => {
                          setApproving(true);
                          try { await onApprove(); } finally { setApproving(false); }
                        }}
                      >
                        {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Aprobar presupuesto
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCancel}>
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave}>
                      <Save className="w-3.5 h-3.5" /> Guardar cambios
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Development costs */}
            {displayData.development && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Package className="w-4 h-4 text-primary" />
                  Costes de Desarrollo
                </h4>
                <Card className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    {displayData.development.phases?.map((phase, i) => (
                      <div key={i} className="flex items-center justify-between text-sm gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-foreground">{phase.name}</span>
                          {phase.description && (
                            <p className="text-xs text-muted-foreground">{phase.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {editing ? (
                            <>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={phase.hours}
                                  onChange={e => updatePhaseHours(i, Number(e.target.value) || 0)}
                                  className="w-16 h-7 text-xs text-right"
                                  min={0}
                                />
                                <span className="text-xs text-muted-foreground">h</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">€</span>
                                <Input
                                  type="number"
                                  value={phase.cost_eur}
                                  onChange={e => updatePhaseCost(i, Number(e.target.value) || 0)}
                                  className="w-20 h-7 text-xs text-right"
                                  min={0}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="text-right">
                              <span className="text-foreground font-medium">€{(phase.cost_eur ?? 0).toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground ml-1">({phase.hours ?? 0}h)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Hourly rate — internal only */}
                    {!isClientView && (
                    <div className="border-t border-border/50 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tarifa por hora</span>
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <span>€</span>
                          <Input
                            type="number"
                            value={editData?.development.hourly_rate_eur ?? 0}
                            onChange={e => updateHourlyRate(Number(e.target.value) || 0)}
                            className="w-16 h-7 text-xs text-right"
                            min={0}
                          />
                          <span>/h</span>
                        </div>
                      ) : (
                        <span>€{displayData.development.hourly_rate_eur ?? 0}/h · {displayData.development.total_hours ?? 0}h totales</span>
                      )}
                    </div>
                    )}

                    <div className="border-t border-border/50 pt-2 flex justify-between text-sm font-semibold">
                      <span>Total desarrollo</span>
                      <span className="text-primary">€{(displayData.development.total_development_eur ?? 0).toLocaleString()}</span>
                    </div>
                    {!isClientView && displayData.development.your_cost_eur != null && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Tu coste real</span>
                        <span>€{displayData.development.your_cost_eur.toLocaleString()} ({displayData.development.margin_pct ?? 0}% margen)</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recurring costs */}
            {displayData.recurring_monthly && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Server className="w-4 h-4 text-primary" />
                  Costes Recurrentes (mensual)
                </h4>
                <Card className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    {displayData.recurring_monthly.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-foreground">{item.name}</span>
                          {item.notes && <span className="text-xs text-muted-foreground ml-1">— {item.notes}</span>}
                        </div>
                        {editing ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-muted-foreground">€</span>
                            <Input
                              type="number"
                              value={item.cost_eur}
                              onChange={e => updateRecurringItem(i, Number(e.target.value) || 0)}
                              className="w-20 h-7 text-xs text-right"
                              min={0}
                            />
                            <span className="text-xs text-muted-foreground">/mes</span>
                          </div>
                        ) : (
                          <span className="text-foreground font-medium shrink-0">€{item.cost_eur ?? 0}/mes</span>
                        )}
                      </div>
                    ))}
                    {!displayData.recurring_monthly.items && (
                      <>
                        {displayData.recurring_monthly.hosting != null && (
                          <div className="flex justify-between text-sm">
                            <span>Hosting</span>
                            <span>€{displayData.recurring_monthly.hosting}/mes</span>
                          </div>
                        )}
                        {displayData.recurring_monthly.ai_apis != null && (
                          <div className="flex justify-between text-sm">
                            <span>APIs IA</span>
                            <span>€{displayData.recurring_monthly.ai_apis}/mes</span>
                          </div>
                        )}
                      </>
                    )}
                    {displayData.recurring_monthly.maintenance_eur != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Mantenimiento</span>
                        {editing ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              type="number"
                              value={editData?.recurring_monthly.maintenance_hours ?? 0}
                              onChange={e => updateMaintenanceHours(Number(e.target.value) || 0)}
                              className="w-16 h-7 text-xs text-right"
                              min={0}
                            />
                            <span className="text-xs text-muted-foreground">h → €{displayData.recurring_monthly.maintenance_eur}/mes</span>
                          </div>
                        ) : (
                          <span>€{displayData.recurring_monthly.maintenance_eur}/mes ({displayData.recurring_monthly.maintenance_hours ?? 0}h)</span>
                        )}
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-2 flex justify-between text-sm font-semibold">
                      <span>Total mensual</span>
                      <span className="text-primary">€{(displayData.recurring_monthly.total_monthly_eur ?? 0)}/mes</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Monetization models */}
            {displayData.monetization_models && displayData.monetization_models.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Presupuestos por Modelo de Monetización
                </h4>
                <div className="grid gap-3">
                  {displayData.monetization_models.map((model, i) => {
                    const isRecommended = displayData.recommended_model === model.name;
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
                            {!isClientView && (
                              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer shrink-0">
                                <Checkbox
                                  checked={model.visible_to_client ?? isRecommended}
                                  onCheckedChange={(checked) => {
                                    if (!editData) return;
                                    const models = [...editData.monetization_models];
                                    models[i] = { ...models[i], visible_to_client: checked === true };
                                    setEditData({ ...editData, monetization_models: models });
                                    onBudgetUpdate?.({ ...editData, monetization_models: models });
                                  }}
                                  className="h-3 w-3"
                                />
                                <Users className="w-3 h-3" /> Mostrar al cliente
                              </label>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs">
                            {(model.setup_price_eur || editing) && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Setup:</span>
                                {editing ? (
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-muted-foreground">€</span>
                                    <Input
                                      type="text"
                                      value={model.setup_price_eur ?? ""}
                                      onChange={e => {
                                        if (!editData) return;
                                        const models = [...editData.monetization_models];
                                        models[i] = { ...models[i], setup_price_eur: e.target.value };
                                        setEditData({ ...editData, monetization_models: models });
                                      }}
                                      className="w-28 h-7 text-xs"
                                      placeholder="ej. 25000-30000"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-foreground font-medium ml-1">€{model.setup_price_eur}</span>
                                )}
                                {/* Sync indicator: solo en modelo recomendado y si hay total de desarrollo. */}
                                {isRecommended &&
                                  displayData.development?.total_development_eur != null &&
                                  parseFirstAmount(model.setup_price_eur) != null &&
                                  !isSetupSynced(displayData) && (
                                    <>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-600 bg-amber-500/5"
                                        title={`Total desarrollo (${displayData.development.total_development_eur.toLocaleString()} €) ≠ setup del cliente`}
                                      >
                                        Override
                                      </Badge>
                                      {editing && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-1.5 text-[10px]"
                                          onClick={() => editData && setEditData(syncSetupWithDev(editData))}
                                        >
                                          Sincronizar
                                        </Button>
                                      )}
                                    </>
                                  )}
                              </div>
                            )}
                            {(model.monthly_price_eur || editing) && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Mensual:</span>
                                {editing ? (
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-muted-foreground">€</span>
                                    <Input
                                      type="text"
                                      value={model.monthly_price_eur ?? ""}
                                      onChange={e => {
                                        if (!editData) return;
                                        const models = [...editData.monetization_models];
                                        models[i] = { ...models[i], monthly_price_eur: e.target.value };
                                        setEditData({ ...editData, monetization_models: models });
                                      }}
                                      className="w-36 h-7 text-xs"
                                      placeholder="ej. 35-45 por vehículo"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-foreground font-medium ml-1">€{model.monthly_price_eur}</span>
                                )}
                              </div>
                            )}
                            {(model.price_range || editing) && !model.setup_price_eur && !model.monthly_price_eur && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Precio:</span>
                                {editing ? (
                                  <Input
                                    type="text"
                                    value={model.price_range ?? ""}
                                    onChange={e => {
                                      if (!editData) return;
                                      const models = [...editData.monetization_models];
                                      models[i] = { ...models[i], price_range: e.target.value };
                                      setEditData({ ...editData, monetization_models: models });
                                    }}
                                    className="w-32 h-7 text-xs"
                                    placeholder="ej. 500-1000/mes"
                                  />
                                ) : (
                                  <span className="text-foreground font-medium ml-1">{model.price_range}</span>
                                )}
                              </div>
                            )}
                            {!isClientView && (model.your_margin_pct != null || editing) && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Margen:</span>
                                {editing ? (
                                  <div className="flex items-center gap-0.5">
                                    <Input
                                      type="number"
                                      value={model.your_margin_pct ?? ""}
                                      onChange={e => {
                                        if (!editData) return;
                                        const models = [...editData.monetization_models];
                                        models[i] = { ...models[i], your_margin_pct: Number(e.target.value) || 0 };
                                        setEditData({ ...editData, monetization_models: models });
                                      }}
                                      className="w-16 h-7 text-xs text-right"
                                      min={0}
                                      max={100}
                                    />
                                    <span className="text-muted-foreground">%</span>
                                  </div>
                                ) : (
                                  <span className="text-foreground font-medium ml-1">{model.your_margin_pct}%</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {model.pros?.length > 0 && (
                              <div>
                                <span className="text-green-600 font-medium">Pros:</span>
                                <ul className="mt-0.5 space-y-0.5">
                                  {model.pros.map((p, j) => (
                                    <li key={j} className="text-muted-foreground">+ {p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {model.cons?.length > 0 && (
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

            {/* Plazos de implementación (override del cronograma del PDF cliente) */}
            {editing && editData && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Calculator className="w-4 h-4 text-primary" />
                  Plazos de implementación
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (opcional · se muestra en la propuesta cliente)
                  </span>
                </h4>
                <Card className="border-border/50">
                  <CardContent className="p-3 space-y-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      Si se dejan en blanco, el cronograma se calcula automáticamente
                      a partir del nº de componentes MVP / Fast-follow del Step 28.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Semanas MVP</span>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          placeholder="auto"
                          value={editData.implementation_override?.mvp_weeks ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Number(e.target.value);
                            setEditData({
                              ...editData,
                              implementation_override: { ...editData.implementation_override, mvp_weeks: v },
                            });
                          }}
                          className="h-8 text-sm"
                        />
                      </label>
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Semanas Fast-follow</span>
                        <Input
                          type="number"
                          min={0}
                          max={52}
                          placeholder="auto"
                          value={editData.implementation_override?.fast_follow_weeks ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Number(e.target.value);
                            setEditData({
                              ...editData,
                              implementation_override: { ...editData.implementation_override, fast_follow_weeks: v },
                            });
                          }}
                          className="h-8 text-sm"
                        />
                      </label>
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Fecha de arranque (opcional)</span>
                        <Input
                          type="date"
                          value={editData.implementation_override?.start_date ?? ""}
                          onChange={(e) => {
                            setEditData({
                              ...editData,
                              implementation_override: { ...editData.implementation_override, start_date: e.target.value || undefined },
                            });
                          }}
                          className="h-8 text-sm"
                        />
                      </label>
                      <label className="text-xs space-y-1 sm:col-span-2">
                        <span className="text-muted-foreground">Notas de plazos (opcional)</span>
                        <Input
                          type="text"
                          placeholder="Ej: incluye 1 semana de buffer por vacaciones de agosto"
                          value={editData.implementation_override?.notes ?? ""}
                          onChange={(e) => {
                            setEditData({
                              ...editData,
                              implementation_override: { ...editData.implementation_override, notes: e.target.value || undefined },
                            });
                          }}
                          className="h-8 text-sm"
                        />
                      </label>
                    </div>
                    {editData.implementation_override &&
                      Object.values(editData.implementation_override).some((v) => v !== undefined && v !== "") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[11px] h-7 px-2"
                          onClick={() => setEditData({ ...editData, implementation_override: undefined })}
                        >
                          Restaurar valores sugeridos
                        </Button>
                      )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Risk factors */}
            {displayData.risk_factors && displayData.risk_factors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Factores de Riesgo
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                  {displayData.risk_factors.map((r, i) => (
                    <li key={i} className="list-disc">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {displayData.pricing_notes && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/20 pl-3">
                {displayData.pricing_notes}
              </p>
            )}

            {/* Bloque export presupuesto eliminado: el cliente recibe la propuesta (Paso 5), no el presupuesto. */}
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
};
