import { useState } from "react";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDailyLogs } from "@/hooks/useDailyLogs";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
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
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [workWin, setWorkWin] = useState("");
  const [lifeWin, setLifeWin] = useState("");
  const [tomorrowAdjust, setTomorrowAdjust] = useState("");
  const [saving, setSaving] = useState(false);

  const { todayLog, historicalLogs, loading, saveTodayLog } = useDailyLogs();

  const handleSaveClose = async () => {
    if (!workWin || !lifeWin || !tomorrowAdjust) {
      toast.error("Completa todos los campos del cierre");
      return;
    }
    
    setSaving(true);
    await saveTodayLog({ workWin, lifeWin, tomorrowAdjust });
    setSaving(false);
    
    setWorkWin("");
    setLifeWin("");
    setTomorrowAdjust("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">CARGANDO LOGS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SidebarNew 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 lg:p-6 space-y-6">
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
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Cierre del día
                <Badge className="ml-2 bg-primary/20 text-primary border-primary/30 font-mono">1 MIN</Badge>
                {todayLog && (
                  <Badge className="ml-2 bg-success/20 text-success border-success/30 font-mono">GUARDADO</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    1 logro trabajo
                  </label>
                  <Textarea
                    placeholder="¿Qué conseguiste hoy en el trabajo?"
                    value={workWin}
                    onChange={(e) => setWorkWin(e.target.value)}
                    className="bg-background border-border resize-none h-24 font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    1 logro vida
                  </label>
                  <Textarea
                    placeholder="¿Qué hiciste por ti o tu familia?"
                    value={lifeWin}
                    onChange={(e) => setLifeWin(e.target.value)}
                    className="bg-background border-border resize-none h-24 font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-warning" />
                    1 ajuste para mañana
                  </label>
                  <Textarea
                    placeholder="¿Qué harías diferente mañana?"
                    value={tomorrowAdjust}
                    onChange={(e) => setTomorrowAdjust(e.target.value)}
                    className="bg-background border-border resize-none h-24 font-mono text-sm"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSaveClose}
                disabled={saving}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar cierre del día
              </Button>
            </CardContent>
          </Card>

          {/* Historical Logs */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground font-mono">HISTORIAL</h2>
            
            {historicalLogs.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No hay logs anteriores</p>
                </CardContent>
              </Card>
            ) : (
              historicalLogs.map((log) => (
                <Card key={log.id} className="border-border bg-card">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        {new Date(log.date).toLocaleDateString("es-ES", { 
                          weekday: "long", 
                          day: "numeric", 
                          month: "long" 
                        })}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-success/30 text-success font-mono">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {log.completedCount}/{log.plannedCount}
                        </Badge>
                        {log.movedCount > 0 && (
                          <Badge variant="outline" className="text-xs border-warning/30 text-warning font-mono">
                            {log.movedCount} movidas
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Wins */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Logro trabajo</p>
                        <p className="text-sm text-foreground">{log.workWin || "—"}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Logro vida</p>
                        <p className="text-sm text-foreground">{log.lifeWin || "—"}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Ajuste</p>
                        <p className="text-sm text-foreground">{log.tomorrowAdjust || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Logs;
