import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, BarChart3, CheckCircle2, FileText, Tag, Target } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

type LabelValue = "baja" | "media" | "alta" | "";

interface CalibrationMetrics {
  total_audits: number;
  labeled_audits: number;
  labeling_pct: number;
  avg_digital_maturity: number | null;
  avg_ai_opportunity: number | null;
  avg_automation_level: number | null;
  avg_data_readiness: number | null;
  error_digital_maturity: number | null;
  error_ai_opportunity: number | null;
  error_automation_level: number | null;
  error_data_readiness: number | null;
  p50_error_digital_maturity: number | null;
  p50_error_ai_opportunity: number | null;
  p50_error_automation_level: number | null;
  p50_error_data_readiness: number | null;
  p90_error_digital_maturity: number | null;
  p90_error_ai_opportunity: number | null;
  p90_error_automation_level: number | null;
  p90_error_data_readiness: number | null;
  priority_correct_pct: number | null;
}

interface ScoreDistRow {
  score_name: string;
  bucket_0_24: number;
  bucket_25_49: number;
  bucket_50_74: number;
  bucket_75_100: number;
}

interface AuditDiagnostic {
  id: string;
  audit_id: string;
  audit_name: string;
  digital_maturity_score: number | null;
  ai_opportunity_score: number | null;
  automation_level: number | null;
  data_readiness: number | null;
  priority_recommendation: string | null;
}

const BUCKET_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];

const errorBadge = (val: number | null) => {
  if (val == null) return { color: "text-muted-foreground bg-muted", label: "N/A", hint: "" };
  if (val < 15) return { color: "text-green-400 bg-green-400/10 border-green-400/30", label: `${val}`, hint: "Bien calibrado" };
  if (val <= 25) return { color: "text-amber-400 bg-amber-400/10 border-amber-400/30", label: `${val}`, hint: "Revisar pesos" };
  return { color: "text-red-400 bg-red-400/10 border-red-400/30", label: `${val}`, hint: "Desalineación alta" };
};

const CalibrationDashboard = () => {
  const [metrics, setMetrics] = useState<CalibrationMetrics | null>(null);
  const [distribution, setDistribution] = useState<ScoreDistRow[]>([]);
  const [audits, setAudits] = useState<AuditDiagnostic[]>([]);
  const [selectedDiagId, setSelectedDiagId] = useState<string>("");
  const [labelForm, setLabelForm] = useState({
    digital_maturity_label: "" as LabelValue,
    ai_opportunity_label: "" as LabelValue,
    automation_level_label: "" as LabelValue,
    data_readiness_label: "" as LabelValue,
    recommendation_correct: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchMetrics(), fetchDistribution(), fetchAudits()]);
    setLoading(false);
  };

  const fetchMetrics = async () => {
    const { data } = await supabase.from("bl_calibration_metrics").select("*").single();
    if (data) setMetrics(data as unknown as CalibrationMetrics);
  };

  const fetchDistribution = async () => {
    const { data } = await supabase.from("bl_score_distribution").select("*");
    if (data) setDistribution(data as unknown as ScoreDistRow[]);
  };

  const fetchAudits = async () => {
    const { data } = await supabase
      .from("bl_diagnostics")
      .select("id, audit_id, digital_maturity_score, ai_opportunity_score, automation_level, data_readiness, priority_recommendation, bl_audits!inner(name)")
      .not("audit_id", "is", null)
      .order("created_at", { ascending: false });

    if (data) {
      setAudits(
        data.map((d: any) => ({
          id: d.id,
          audit_id: d.audit_id,
          audit_name: d.bl_audits?.name || "Sin nombre",
          digital_maturity_score: d.digital_maturity_score,
          ai_opportunity_score: d.ai_opportunity_score,
          automation_level: d.automation_level,
          data_readiness: d.data_readiness,
          priority_recommendation: d.priority_recommendation,
        }))
      );
    }
  };

  const handleSelectAudit = async (diagId: string) => {
    setSelectedDiagId(diagId);
    // Load existing label if any
    const { data } = await supabase
      .from("bl_diagnostics_labels")
      .select("*")
      .eq("diagnostic_id", diagId)
      .maybeSingle();

    if (data) {
      setLabelForm({
        digital_maturity_label: (data.digital_maturity_label as LabelValue) || "",
        ai_opportunity_label: (data.ai_opportunity_label as LabelValue) || "",
        automation_level_label: (data.automation_level_label as LabelValue) || "",
        data_readiness_label: (data.data_readiness_label as LabelValue) || "",
        recommendation_correct: data.recommendation_correct ?? false,
        notes: data.notes || "",
      });
    } else {
      setLabelForm({
        digital_maturity_label: "",
        ai_opportunity_label: "",
        automation_level_label: "",
        data_readiness_label: "",
        recommendation_correct: false,
        notes: "",
      });
    }
  };

  const handleSaveLabel = async () => {
    if (!selectedDiagId) return;
    setSaving(true);

    const payload = {
      diagnostic_id: selectedDiagId,
      digital_maturity_label: labelForm.digital_maturity_label || null,
      ai_opportunity_label: labelForm.ai_opportunity_label || null,
      automation_level_label: labelForm.automation_level_label || null,
      data_readiness_label: labelForm.data_readiness_label || null,
      recommendation_correct: labelForm.recommendation_correct,
      notes: labelForm.notes || null,
    };

    const { error } = await supabase
      .from("bl_diagnostics_labels")
      .upsert(payload, { onConflict: "diagnostic_id,labeled_by" });

    setSaving(false);
    if (error) {
      toast.error("Error al guardar etiqueta");
      console.error(error);
    } else {
      toast.success("Etiqueta guardada");
      fetchMetrics();
    }
  };

  const selectedAudit = audits.find((a) => a.id === selectedDiagId);

  const aiOppDist = distribution.find((d) => d.score_name === "ai_opportunity");
  const chartData = aiOppDist
    ? [
        { name: "0-24", value: aiOppDist.bucket_0_24 },
        { name: "25-49", value: aiOppDist.bucket_25_49 },
        { name: "50-74", value: aiOppDist.bucket_50_74 },
        { name: "75-100", value: aiOppDist.bucket_75_100 },
      ]
    : [];

  const errorScores = [
    { label: "Digital Maturity", value: metrics?.error_digital_maturity ?? null, p50: metrics?.p50_error_digital_maturity ?? null, p90: metrics?.p90_error_digital_maturity ?? null },
    { label: "AI Opportunity", value: metrics?.error_ai_opportunity ?? null, p50: metrics?.p50_error_ai_opportunity ?? null, p90: metrics?.p90_error_ai_opportunity ?? null },
    { label: "Automation Level", value: metrics?.error_automation_level ?? null, p50: metrics?.p50_error_automation_level ?? null, p90: metrics?.p90_error_automation_level ?? null },
    { label: "Data Readiness", value: metrics?.error_data_readiness ?? null, p50: metrics?.p50_error_data_readiness ?? null, p90: metrics?.p90_error_data_readiness ?? null },
  ];

  const LabelSelect = ({ label, value, onChange }: { label: string; value: LabelValue; onChange: (v: LabelValue) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as LabelValue)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Sin etiquetar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="baja">Baja (0)</SelectItem>
          <SelectItem value="media">Media (50)</SelectItem>
          <SelectItem value="alta">Alta (100)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <Breadcrumbs />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 space-y-6">
      <Breadcrumbs />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Calibración de Scoring</h1>
        <p className="text-sm text-muted-foreground mt-1">Dashboard interno para calibrar los scores de Auditoría IA</p>
      </div>

      {/* Operation Rule Banner */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Regla de operación</p>
            <p className="text-xs text-muted-foreground mt-1">
              Primeras 100 auditorías: <strong>NO cambiar pesos automáticamente</strong>. Solo observar métricas.
              Ajustes manuales cada 25–50 auditorías.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <FileText className="w-5 h-5 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{metrics?.total_audits ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total auditorías</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <Tag className="w-5 h-5 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{metrics?.labeled_audits ?? 0}</p>
            <p className="text-xs text-muted-foreground">Etiquetadas</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{metrics?.labeling_pct ?? 0}%</p>
            <p className="text-xs text-muted-foreground">% Etiquetado</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <Target className="w-5 h-5 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {metrics?.priority_correct_pct != null ? `${metrics.priority_correct_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">% Prioridad correcta</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Medio por Score */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono">ERROR MEDIO POR SCORE</CardTitle>
          <p className="text-xs text-muted-foreground">|score_modelo - score_label| promedio. Verde &lt;15, Ámbar 15-25, Rojo &gt;25</p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {metrics?.labeled_audits === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin etiquetas aún. Etiqueta auditorías para ver errores.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {errorScores.map((s) => {
                const badge = errorBadge(s.value);
                return (
                  <div key={s.label} className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <Badge variant="outline" className={`text-xs ${badge.color}`}>{badge.label}</Badge>
                    </div>
                    {badge.hint && (
                      <span className={`text-[10px] font-medium ${badge.color.split(' ')[0]}`}>{badge.hint}</span>
                    )}
                    {(s.p50 != null || s.p90 != null) && (
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        {s.p50 != null && <span>p50: {s.p50}</span>}
                        {s.p90 != null && <span>p90: {s.p90}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Opportunity Distribution Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono">DISTRIBUCIÓN AI OPPORTUNITY</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {chartData.length > 0 && chartData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sin datos de distribución aún.</p>
          )}
        </CardContent>
      </Card>

      {/* Labeling Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            ETIQUETADO MANUAL
          </CardTitle>
          <p className="text-xs text-muted-foreground">Selecciona una auditoría, revisa sus scores y asigna labels de ground truth.</p>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Audit selector */}
          <Select value={selectedDiagId} onValueChange={handleSelectAudit}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar auditoría..." />
            </SelectTrigger>
            <SelectContent>
              {audits.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.audit_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedAudit && (
            <>
              {/* Current scores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-[10px] text-muted-foreground">Digital Maturity</p>
                  <p className="text-sm font-bold text-foreground">{selectedAudit.digital_maturity_score ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">AI Opportunity</p>
                  <p className="text-sm font-bold text-foreground">{selectedAudit.ai_opportunity_score ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Automation Level</p>
                  <p className="text-sm font-bold text-foreground">{selectedAudit.automation_level ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Data Readiness</p>
                  <p className="text-sm font-bold text-foreground">{selectedAudit.data_readiness ?? "—"}</p>
                </div>
              </div>

              {selectedAudit.priority_recommendation && (
                <div className="p-2 rounded bg-muted/20 text-xs text-muted-foreground">
                  <strong>Prioridad:</strong> {selectedAudit.priority_recommendation}
                </div>
              )}

              {/* Label form */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <LabelSelect
                  label="Digital Maturity"
                  value={labelForm.digital_maturity_label}
                  onChange={(v) => setLabelForm({ ...labelForm, digital_maturity_label: v })}
                />
                <LabelSelect
                  label="AI Opportunity"
                  value={labelForm.ai_opportunity_label}
                  onChange={(v) => setLabelForm({ ...labelForm, ai_opportunity_label: v })}
                />
                <LabelSelect
                  label="Automation Level"
                  value={labelForm.automation_level_label}
                  onChange={(v) => setLabelForm({ ...labelForm, automation_level_label: v })}
                />
                <LabelSelect
                  label="Data Readiness"
                  value={labelForm.data_readiness_label}
                  onChange={(v) => setLabelForm({ ...labelForm, data_readiness_label: v })}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={labelForm.recommendation_correct}
                  onCheckedChange={(v) => setLabelForm({ ...labelForm, recommendation_correct: v })}
                />
                <Label className="text-sm">Recomendación prioritaria correcta</Label>
              </div>

              <Textarea
                placeholder="Notas de calibración..."
                value={labelForm.notes}
                onChange={(e) => setLabelForm({ ...labelForm, notes: e.target.value })}
                className="min-h-[80px]"
              />

              <Button onClick={handleSaveLabel} disabled={saving} className="w-full sm:w-auto">
                {saving ? "Guardando..." : "Guardar etiqueta"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default CalibrationDashboard;
