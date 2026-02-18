import { useState } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDailyLogs } from "@/hooks/useDailyLogs";
import { 
  BookOpen, 
  Calendar,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Save,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

const Logs = () => {
  const [workWin, setWorkWin] = useState("");
  const [lifeWin, setLifeWin] = useState("");
  const [tomorrowAdjust, setTomorrowAdjust] = useState("");
  const [saving, setSaving] = useState(false);

  const { todayLog, historicalLogs, loading, saveTodayLog } = useDailyLogs();

  const handleSave = async () => {
    if (!workWin.trim() && !lifeWin.trim() && !tomorrowAdjust.trim()) {
      toast.error("Escribe al menos un campo");
      return;
    }
    setSaving(true);
    try {
      await saveTodayLog({
        work_win: workWin.trim() || undefined,
        life_win: lifeWin.trim() || undefined,
        tomorrow_adjust: tomorrowAdjust.trim() || undefined,
      });
      toast.success("Log guardado correctamente");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs Diarios</h1>
          <p className="text-sm text-muted-foreground font-mono">REGISTRO DE EVOLUCIÓN</p>
        </div>
      </div>

      {/* Today's Close */}
      <Card className="border-primary/30 bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Cierre del Día
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              🏆 Victoria profesional de hoy
            </label>
            <Textarea
              value={workWin}
              onChange={e => setWorkWin(e.target.value)}
              placeholder="¿Qué lograste hoy en el trabajo?"
              className="resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              ❤️ Victoria personal de hoy
            </label>
            <Textarea
              value={lifeWin}
              onChange={e => setLifeWin(e.target.value)}
              placeholder="¿Qué te hizo sentir bien fuera del trabajo?"
              className="resize-none"
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              🔄 Ajuste para mañana
            </label>
            <Textarea
              value={tomorrowAdjust}
              onChange={e => setTomorrowAdjust(e.target.value)}
              placeholder="¿Qué cambiarías o repetirías mañana?"
              className="resize-none"
              rows={2}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cierre
          </Button>
        </CardContent>
      </Card>

      {/* Today's Log Summary */}
      {todayLog && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Hoy — Resumen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{todayLog.completed_count ?? 0}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayLog.energy_avg ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Energía</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayLog.mood_avg ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Ánimo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Logs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          Historial
        </h2>
        {historicalLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay logs anteriores todavía.</p>
        ) : (
          historicalLogs.map(log => (
            <Card key={log.id} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-xs">{log.date}</Badge>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {log.completed_count != null && <span>✅ {log.completed_count}</span>}
                    {log.energy_avg != null && <span>⚡ {log.energy_avg}</span>}
                    {log.mood_avg != null && <span>😊 {log.mood_avg}</span>}
                  </div>
                </div>
                {log.work_win && <p className="text-xs text-foreground">🏆 {log.work_win}</p>}
                {log.life_win && <p className="text-xs text-foreground mt-1">❤️ {log.life_win}</p>}
                {log.tomorrow_adjust && <p className="text-xs text-muted-foreground mt-1">🔄 {log.tomorrow_adjust}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Logs;
