import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  BookOpen, 
  Calendar,
  CheckCircle,
  XCircle,
  ArrowRight,
  Sparkles,
  Save
} from "lucide-react";
import { toast } from "sonner";

interface DailyLog {
  date: string;
  checkIn: {
    energy: number;
    mood: number;
    focus: number;
  };
  planned: number;
  completed: number;
  moved: number;
  workWin: string;
  lifeWin: string;
  tomorrowAdjust: string;
}

const mockLogs: DailyLog[] = [
  {
    date: "2024-01-15",
    checkIn: { energy: 4, mood: 4, focus: 3 },
    planned: 6,
    completed: 5,
    moved: 1,
    workWin: "Entregué la propuesta del cliente A antes de tiempo",
    lifeWin: "30 min de ejercicio + meditación",
    tomorrowAdjust: "Empezar con Deep Work antes de revisar emails"
  },
  {
    date: "2024-01-14",
    checkIn: { energy: 3, mood: 3, focus: 4 },
    planned: 5,
    completed: 4,
    moved: 1,
    workWin: "Cerré reunión con nuevo lead",
    lifeWin: "Tiempo de calidad con familia",
    tomorrowAdjust: "Bloquear más tiempo para admin"
  },
];

const Logs = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workWin, setWorkWin] = useState("");
  const [lifeWin, setLifeWin] = useState("");
  const [tomorrowAdjust, setTomorrowAdjust] = useState("");

  const handleSaveClose = () => {
    if (!workWin || !lifeWin || !tomorrowAdjust) {
      toast.error("Completa todos los campos del cierre");
      return;
    }
    
    toast.success("Cierre del día guardado", {
      description: "JARVIS analizará tu día para mejorar mañana.",
    });
    
    setWorkWin("");
    setLifeWin("");
    setTomorrowAdjust("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Logs Diarios</h1>
              <p className="text-sm text-muted-foreground">Registro y análisis de tu evolución</p>
            </div>
          </div>

          {/* Today's Close */}
          <Card className="border-primary/30 bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Cierre del día
                <Badge className="ml-2 bg-primary/20 text-primary border-primary/30">1 minuto</Badge>
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
                    className="bg-background border-border resize-none h-24"
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
                    className="bg-background border-border resize-none h-24"
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
                    className="bg-background border-border resize-none h-24"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSaveClose}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar cierre del día
              </Button>
            </CardContent>
          </Card>

          {/* Historical Logs */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Historial</h2>
            
            {mockLogs.map((log) => (
              <Card key={log.date} className="border-border bg-card">
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
                      <Badge variant="outline" className="text-xs border-success/30 text-success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {log.completed}/{log.planned}
                      </Badge>
                      {log.moved > 0 && (
                        <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                          {log.moved} movidas
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    {/* Check-in Summary */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-in</p>
                      <div className="flex gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{log.checkIn.energy}</p>
                          <p className="text-xs text-muted-foreground">Energía</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{log.checkIn.mood}</p>
                          <p className="text-xs text-muted-foreground">Ánimo</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{log.checkIn.focus}</p>
                          <p className="text-xs text-muted-foreground">Foco</p>
                        </div>
                      </div>
                    </div>

                    {/* Wins */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Logro trabajo</p>
                      <p className="text-sm text-foreground">{log.workWin}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Logro vida</p>
                      <p className="text-sm text-foreground">{log.lifeWin}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Ajuste</p>
                      <p className="text-sm text-foreground">{log.tomorrowAdjust}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Logs;
