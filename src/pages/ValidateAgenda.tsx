import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DailyPlan, TimeBlock } from "@/hooks/useJarvisCore";
import {
  Brain,
  Calendar,
  Check,
  Clock,
  Sparkles,
  AlertTriangle,
  Briefcase,
  Heart,
  Users,
  Activity,
  Coffee,
  ChevronRight,
  Loader2
} from "lucide-react";

const typeConfig = {
  work: { icon: Briefcase, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Trabajo" },
  life: { icon: Coffee, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Personal" },
  health: { icon: Activity, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", label: "Salud" },
  family: { icon: Users, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", label: "Familia" },
  rest: { icon: Heart, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Descanso" },
};

interface TimeBlockWithCalendar extends TimeBlock {
  addToCalendar: boolean;
  approved: boolean;
}

const ValidateAgenda = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { createEvent, loading: calendarLoading } = useGoogleCalendar();

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockWithCalendar[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addAllToCalendar, setAddAllToCalendar] = useState(true);

  useEffect(() => {
    // Get plan from navigation state
    const statePlan = location.state?.plan as DailyPlan | undefined;
    if (statePlan) {
      setPlan(statePlan);
      setTimeBlocks(
        statePlan.timeBlocks.map(block => ({
          ...block,
          addToCalendar: true,
          approved: true,
        }))
      );
    } else {
      // No plan in state, redirect back
      navigate("/start-day");
    }
  }, [location.state, navigate]);

  const toggleBlockApproval = (index: number) => {
    setTimeBlocks(prev => prev.map((block, i) => 
      i === index ? { ...block, approved: !block.approved } : block
    ));
  };

  const toggleBlockCalendar = (index: number) => {
    setTimeBlocks(prev => prev.map((block, i) => 
      i === index ? { ...block, addToCalendar: !block.addToCalendar } : block
    ));
  };

  const toggleAllCalendar = (checked: boolean) => {
    setAddAllToCalendar(checked);
    setTimeBlocks(prev => prev.map(block => ({ ...block, addToCalendar: checked })));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const blocksToAdd = timeBlocks.filter(block => block.approved && block.addToCalendar);
      
      for (const block of blocksToAdd) {
        const today = new Date().toISOString().split('T')[0];
        await createEvent({
          title: block.title,
          date: today,
          time: block.time,
          duration: calculateDuration(block.time, block.endTime),
          type: block.type === "rest" ? "life" : block.type,
        });
      }

      if (blocksToAdd.length > 0) {
        toast.success(`${blocksToAdd.length} bloques añadidos al calendario`);
      }
      
      toast.success("¡Agenda del día confirmada!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error adding events:", error);
      toast.error("Error al añadir eventos al calendario");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return ((endH * 60 + endM) - (startH * 60 + startM));
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const approvedCount = timeBlocks.filter(b => b.approved).length;
  const calendarCount = timeBlocks.filter(b => b.approved && b.addToCalendar).length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                Validar Agenda
              </h1>
              <p className="text-muted-foreground">Revisa y confirma los bloques de tiempo propuestos por JARVIS</p>
            </div>
          </div>

          {/* Diagnosis Summary */}
          {plan.diagnosis && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                    plan.diagnosis.dayMode === "push" && "bg-success/20",
                    plan.diagnosis.dayMode === "balanced" && "bg-primary/20",
                    plan.diagnosis.dayMode === "survival" && "bg-warning/20",
                    plan.diagnosis.dayMode === "recovery" && "bg-rose-500/20"
                  )}>
                    <Sparkles className={cn(
                      "w-6 h-6",
                      plan.diagnosis.dayMode === "push" && "text-success",
                      plan.diagnosis.dayMode === "balanced" && "text-primary",
                      plan.diagnosis.dayMode === "survival" && "text-warning",
                      plan.diagnosis.dayMode === "recovery" && "text-rose-500"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Modo: {plan.diagnosis.dayMode}</span>
                      <Badge variant="outline" className="text-xs">
                        Capacidad {plan.diagnosis.capacityLevel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.diagnosis.currentState}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {plan.warnings && plan.warnings.length > 0 && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {plan.warnings.map((warning, i) => (
                      <p key={i} className="text-sm text-warning">{warning}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Añadir todos al calendario</p>
                    <p className="text-xs text-muted-foreground">Los bloques marcados se crearán como eventos en Google Calendar</p>
                  </div>
                </div>
                <Switch
                  checked={addAllToCalendar}
                  onCheckedChange={toggleAllCalendar}
                />
              </div>
            </CardContent>
          </Card>

          {/* Time Blocks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Bloques de Tiempo
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {approvedCount}/{timeBlocks.length} aprobados · {calendarCount} al calendario
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <div className="divide-y divide-border">
                  {timeBlocks.map((block, index) => {
                    const config = typeConfig[block.type] || typeConfig.work;
                    const BlockIcon = config.icon;
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "p-4 transition-all",
                          !block.approved && "opacity-50 bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Approval checkbox */}
                          <Checkbox
                            checked={block.approved}
                            onCheckedChange={() => toggleBlockApproval(index)}
                            className="mt-1"
                          />
                          
                          {/* Time */}
                          <div className="w-20 shrink-0">
                            <p className="font-mono text-sm font-medium">{block.time}</p>
                            <p className="font-mono text-xs text-muted-foreground">{block.endTime}</p>
                          </div>
                          
                          {/* Icon */}
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                            config.color
                          )}>
                            <BlockIcon className="w-5 h-5" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{block.title}</p>
                              {block.priority === "high" && (
                                <Badge variant="destructive" className="text-xs">Alta</Badge>
                              )}
                              {block.isFlexible && (
                                <Badge variant="outline" className="text-xs">Flexible</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {block.description}
                            </p>
                          </div>
                          
                          {/* Calendar toggle */}
                          {block.approved && (
                            <div className="flex items-center gap-2">
                              <Calendar className={cn(
                                "w-4 h-4 transition-colors",
                                block.addToCalendar ? "text-primary" : "text-muted-foreground"
                              )} />
                              <Switch
                                checked={block.addToCalendar}
                                onCheckedChange={() => toggleBlockCalendar(index)}
                                disabled={!block.approved}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/start-day")}
            >
              Volver a editar
            </Button>
            
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || calendarLoading || approvedCount === 0}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Confirmar agenda
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ValidateAgenda;
