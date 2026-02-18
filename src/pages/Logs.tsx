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
  Loader2,
  Trophy,
  Heart,
  RotateCcw,
  Zap,
  Smile
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
        workWin: workWin.trim() || "",
        lifeWin: lifeWin.trim() || "",
        tomorrowAdjust: tomorrowAdjust.trim() || "",
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
            <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-yellow-500" /> Victoria profesional de hoy
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
            <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-500" /> Victoria personal de hoy
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
            <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-muted-foreground" /> Ajuste para mañana
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
                <p className="text-2xl font-bold text-foreground">{todayLog.completedCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayLog.energyAvg ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Energía</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayLog.moodAvg ?? '—'}</p>
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
                    {log.completedCount != null && <span className="flex items-center gap-0.5"><CheckCircle className="w-3 h-3 text-green-500" /> {log.completedCount}</span>}
                    {log.energyAvg != null && <span className="flex items-center gap-0.5"><Zap className="w-3 h-3 text-yellow-500" /> {log.energyAvg}</span>}
                    {log.moodAvg != null && <span className="flex items-center gap-0.5"><Smile className="w-3 h-3 text-pink-500" /> {log.moodAvg}</span>}
                  </div>
                </div>
                {log.workWin && <p className="text-xs text-foreground flex items-center gap-1"><Trophy className="w-3 h-3 text-yellow-500" /> {log.workWin}</p>}
                {log.lifeWin && <p className="text-xs text-foreground mt-1 flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500" /> {log.lifeWin}</p>}
                {log.tomorrowAdjust && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {log.tomorrowAdjust}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Logs;
