import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  ChevronLeft,
  Loader2,
  Pencil,
  X
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

interface EditingState {
  index: number;
  title: string;
  time: string;
  endTime: string;
}

interface ValidateAgendaStepProps {
  plan: DailyPlan;
  onBack: () => void;
  onComplete: () => void;
}

export const ValidateAgendaStep = ({ plan, onBack, onComplete }: ValidateAgendaStepProps) => {
  const navigate = useNavigate();
  const { createEvent, loading: calendarLoading } = useGoogleCalendar();

  const [timeBlocks, setTimeBlocks] = useState<TimeBlockWithCalendar[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addAllToCalendar, setAddAllToCalendar] = useState(true);
  const [editing, setEditing] = useState<EditingState | null>(null);

  useEffect(() => {
    if (plan?.timeBlocks) {
      setTimeBlocks(
        plan.timeBlocks.map(block => ({
          ...block,
          addToCalendar: true,
          approved: true,
        }))
      );
    }
  }, [plan]);

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

  const startEditing = (index: number) => {
    const block = timeBlocks[index];
    setEditing({
      index,
      title: block.title,
      time: block.time,
      endTime: block.endTime,
    });
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const saveEditing = () => {
    if (!editing) return;
    
    const [startH, startM] = editing.time.split(':').map(Number);
    const [endH, endM] = editing.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    if (endMinutes <= startMinutes) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    
    if (!editing.title.trim()) {
      toast.error("El título no puede estar vacío");
      return;
    }

    setTimeBlocks(prev => prev.map((block, i) => 
      i === editing.index 
        ? { ...block, title: editing.title.trim(), time: editing.time, endTime: editing.endTime }
        : block
    ));
    setEditing(null);
    toast.success("Bloque actualizado");
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
      onComplete();
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

  const approvedCount = timeBlocks.filter(b => b.approved).length;
  const calendarCount = timeBlocks.filter(b => b.approved && b.addToCalendar).length;

  return (
    <div className="space-y-6">
      {/* Diagnosis Summary */}
      {plan.diagnosis && (
        <div className="p-4 rounded-lg bg-card border">
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
        </div>
      )}

      {/* Warnings */}
      {plan.warnings && plan.warnings.length > 0 && (
        <div className="p-4 rounded-lg border-warning/50 bg-warning/5 border">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              {plan.warnings.map((warning, i) => (
                <p key={i} className="text-sm text-warning">{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calendar Toggle */}
      <div className="p-4 rounded-lg bg-card border">
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
      </div>

      {/* Time Blocks */}
      <Card>
        <CardHeader className="pb-3">
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
          <ScrollArea className="h-[350px]">
            <div className="divide-y divide-border">
              {timeBlocks.map((block, index) => {
                const config = typeConfig[block.type] || typeConfig.work;
                const BlockIcon = config.icon;
                const isEditing = editing?.index === index;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "p-4 transition-all",
                      !block.approved && "opacity-50 bg-muted/30",
                      isEditing && "bg-primary/5 ring-1 ring-primary/20"
                    )}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            placeholder="Título del bloque"
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={cancelEditing}>
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={saveEditing}>
                            <Check className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Inicio:</span>
                            <Input
                              type="time"
                              value={editing.time}
                              onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                              className="w-32"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Fin:</span>
                            <Input
                              type="time"
                              value={editing.endTime}
                              onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
                              className="w-32"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={block.approved}
                          onCheckedChange={() => toggleBlockApproval(index)}
                          className="mt-1"
                        />
                        
                        <div className="w-20 shrink-0">
                          <p className="font-mono text-sm font-medium">{block.time}</p>
                          <p className="font-mono text-xs text-muted-foreground">{block.endTime}</p>
                        </div>
                        
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          config.color
                        )}>
                          <BlockIcon className="w-5 h-5" />
                        </div>
                        
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
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(index)}
                          className="shrink-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        
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
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>
        
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting || calendarLoading || approvedCount === 0}
          className="gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirmar ({calendarCount} al calendario)
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
