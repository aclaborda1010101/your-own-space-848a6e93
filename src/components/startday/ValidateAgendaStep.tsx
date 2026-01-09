import { useState, useEffect, useMemo, useCallback } from "react";
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
  X,
  AlertCircle,
  RefreshCw
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
  hasConflict?: boolean;
  conflictWith?: string;
}

interface CalendarEventDisplay {
  title: string;
  time: string;
  endTime: string;
  isExternal: true;
}

interface EditingState {
  index: number;
  title: string;
  time: string;
  endTime: string;
}

interface ValidateAgendaStepProps {
  plan: DailyPlan;
  calendarEvents?: Array<{ title: string; time: string; duration: string; endTime?: string }>;
  onBack: () => void;
  onComplete: () => void;
}

// Helper to convert time string to minutes
const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper to check if two time ranges overlap
const hasOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && e1 > s2;
};

// Calculate end time from start time and duration
const calculateEventEndTime = (startTime: string, duration: string): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return startTime;
  
  let durationMinutes = 0;
  const hourMatch = duration.match(/(\d+)\s*h/i);
  const minMatch = duration.match(/(\d+)\s*(?:min|m(?!in)|$)/i);
  
  if (hourMatch) durationMinutes += parseInt(hourMatch[1]) * 60;
  if (minMatch) durationMinutes += parseInt(minMatch[1]);
  if (!hourMatch && !minMatch) {
    const plainNum = parseInt(duration);
    if (!isNaN(plainNum)) durationMinutes = plainNum;
  }
  
  if (durationMinutes === 0) return startTime;
  
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};

export const ValidateAgendaStep = ({ plan, calendarEvents = [], onBack, onComplete }: ValidateAgendaStepProps) => {
  const navigate = useNavigate();
  const { createEvent, loading: calendarLoading, events: googleEvents } = useGoogleCalendar();

  const [timeBlocks, setTimeBlocks] = useState<TimeBlockWithCalendar[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addAllToCalendar, setAddAllToCalendar] = useState(true);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  // Merge external calendar events from props and Google Calendar
  const externalEvents = useMemo(() => {
    const events: CalendarEventDisplay[] = [];
    
    // Add events from props (passed from StartDay)
    calendarEvents.forEach(e => {
      if (e.time && e.time !== 'flexible' && e.time.includes(':')) {
        events.push({
          title: e.title,
          time: e.time,
          endTime: e.endTime || calculateEventEndTime(e.time, e.duration),
          isExternal: true,
        });
      }
    });
    
    // Add Google Calendar events
    googleEvents.forEach(e => {
      if (e.time && e.time.includes(':')) {
        events.push({
          title: e.title,
          time: e.time,
          endTime: calculateEventEndTime(e.time, e.duration),
          isExternal: true,
        });
      }
    });
    
    // Remove duplicates by title+time
    const unique = events.filter((e, i, arr) => 
      arr.findIndex(x => x.title === e.title && x.time === e.time) === i
    );
    
    return unique.sort((a, b) => a.time.localeCompare(b.time));
  }, [calendarEvents, googleEvents]);

  // Detect conflicts between time blocks and external events
  const detectConflicts = useCallback((blocks: TimeBlockWithCalendar[]): TimeBlockWithCalendar[] => {
    return blocks.map(block => {
      if (!block.approved) {
        return { ...block, hasConflict: false, conflictWith: undefined };
      }
      
      // Check against external events
      for (const event of externalEvents) {
        if (hasOverlap(block.time, block.endTime, event.time, event.endTime)) {
          return { ...block, hasConflict: true, conflictWith: event.title };
        }
      }
      
      // Check against other approved blocks
      for (const other of blocks) {
        if (other === block || !other.approved) continue;
        if (hasOverlap(block.time, block.endTime, other.time, other.endTime)) {
          return { ...block, hasConflict: true, conflictWith: other.title };
        }
      }
      
      return { ...block, hasConflict: false, conflictWith: undefined };
    });
  }, [externalEvents]);

  // Initialize and detect conflicts
  useEffect(() => {
    if (plan?.timeBlocks) {
      const initialBlocks = plan.timeBlocks.map(block => ({
        ...block,
        addToCalendar: true,
        approved: true,
      }));
      setTimeBlocks(detectConflicts(initialBlocks));
    }
  }, [plan, detectConflicts]);

  // Re-detect conflicts when blocks change
  const updateBlocksWithConflicts = useCallback((blocks: TimeBlockWithCalendar[]) => {
    setTimeBlocks(detectConflicts(blocks));
  }, [detectConflicts]);

  const toggleBlockApproval = (index: number) => {
    const updated = timeBlocks.map((block, i) => 
      i === index ? { ...block, approved: !block.approved } : block
    );
    updateBlocksWithConflicts(updated);
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

    const updated = timeBlocks.map((block, i) => 
      i === editing.index 
        ? { ...block, title: editing.title.trim(), time: editing.time, endTime: editing.endTime }
        : block
    );
    updateBlocksWithConflicts(updated);
    setEditing(null);
    toast.success("Bloque actualizado");
  };

  // Auto-fix conflicts by adjusting block times
  const autoFixConflicts = () => {
    const sortedBlocks = [...timeBlocks].sort((a, b) => a.time.localeCompare(b.time));
    const fixedBlocks: TimeBlockWithCalendar[] = [];
    
    // Start after external events if possible
    let currentEndTime = "06:00";
    
    for (const block of sortedBlocks) {
      if (!block.approved) {
        fixedBlocks.push(block);
        continue;
      }
      
      const blockDuration = timeToMinutes(block.endTime) - timeToMinutes(block.time);
      let newStartTime = block.time;
      
      // Check if current block conflicts with external events or previous blocks
      let hasConflict = true;
      let attempts = 0;
      
      while (hasConflict && attempts < 20) {
        hasConflict = false;
        const newEndTime = minutesToTime(timeToMinutes(newStartTime) + blockDuration);
        
        // Check against external events
        for (const event of externalEvents) {
          if (hasOverlap(newStartTime, newEndTime, event.time, event.endTime)) {
            // Move to after this event
            newStartTime = event.endTime;
            hasConflict = true;
            break;
          }
        }
        
        // Check against already fixed blocks
        if (!hasConflict) {
          for (const fixed of fixedBlocks.filter(b => b.approved)) {
            if (hasOverlap(newStartTime, newEndTime, fixed.time, fixed.endTime)) {
              newStartTime = fixed.endTime;
              hasConflict = true;
              break;
            }
          }
        }
        
        attempts++;
      }
      
      const finalEndTime = minutesToTime(timeToMinutes(newStartTime) + blockDuration);
      fixedBlocks.push({
        ...block,
        time: newStartTime,
        endTime: finalEndTime,
      });
    }
    
    updateBlocksWithConflicts(fixedBlocks);
    toast.success("Conflictos resueltos automáticamente");
  };

  const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
  const conflictCount = timeBlocks.filter(b => b.hasConflict).length;

  // Combined timeline for visualization
  const combinedTimeline = useMemo(() => {
    const items: Array<{
      time: string;
      endTime: string;
      title: string;
      isExternal: boolean;
      type?: TimeBlock['type'];
      hasConflict?: boolean;
      approved?: boolean;
    }> = [];
    
    // Add external events
    externalEvents.forEach(e => {
      items.push({
        time: e.time,
        endTime: e.endTime,
        title: e.title,
        isExternal: true,
      });
    });
    
    // Add time blocks
    timeBlocks.forEach(block => {
      items.push({
        time: block.time,
        endTime: block.endTime,
        title: block.title,
        isExternal: false,
        type: block.type,
        hasConflict: block.hasConflict,
        approved: block.approved,
      });
    });
    
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [externalEvents, timeBlocks]);

  const displayedBlocks = showConflictsOnly 
    ? timeBlocks.filter(b => b.hasConflict)
    : timeBlocks;

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

      {/* Conflict Alert */}
      {conflictCount > 0 && (
        <div className="p-4 rounded-lg border-destructive/50 bg-destructive/5 border">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {conflictCount} bloque(s) con conflictos detectados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hay solapamientos con eventos del calendario o entre bloques propuestos.
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={autoFixConflicts}
              className="shrink-0 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Auto-resolver
            </Button>
          </div>
        </div>
      )}

      {/* External Events Preview */}
      {externalEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Eventos existentes del calendario
              <Badge variant="secondary" className="ml-auto">{externalEvents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-32 overflow-auto">
              {externalEvents.map((event, i) => (
                <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm bg-muted/30">
                  <div className="w-16 font-mono text-xs text-muted-foreground">
                    {event.time} - {event.endTime}
                  </div>
                  <div className="flex-1 truncate text-muted-foreground">{event.title}</div>
                  <Badge variant="outline" className="text-xs">Bloqueado</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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
              {displayedBlocks.map((block) => {
                const realIndex = timeBlocks.findIndex(b => b === block);
                const config = typeConfig[block.type] || typeConfig.work;
                const BlockIcon = config.icon;
                const isEditing = editing?.index === realIndex;
                
                return (
                  <div
                    key={realIndex}
                    className={cn(
                      "p-4 transition-all",
                      !block.approved && "opacity-50 bg-muted/30",
                      isEditing && "bg-primary/5 ring-1 ring-primary/20",
                      block.hasConflict && block.approved && "bg-destructive/5 ring-1 ring-destructive/30"
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
                              className={cn("w-32", timeBlocks[editing.index]?.hasConflict && "border-destructive")}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Fin:</span>
                            <Input
                              type="time"
                              value={editing.endTime}
                              onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
                              className={cn("w-32", timeBlocks[editing.index]?.hasConflict && "border-destructive")}
                            />
                          </div>
                        </div>
                        {timeBlocks[editing.index]?.hasConflict && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Conflicto: se solapa con &quot;{timeBlocks[editing.index]?.conflictWith}&quot;
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={block.approved}
                          onCheckedChange={() => toggleBlockApproval(realIndex)}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{block.title}</p>
                            {block.priority === "high" && (
                              <Badge variant="destructive" className="text-xs">Alta</Badge>
                            )}
                            {block.isFlexible && (
                              <Badge variant="outline" className="text-xs">Flexible</Badge>
                            )}
                            {block.hasConflict && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Conflicto
                              </Badge>
                            )}
                          </div>
                          {block.hasConflict && block.conflictWith && (
                            <p className="text-xs text-destructive mt-1">
                              Se solapa con: {block.conflictWith}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {block.description}
                          </p>
                        </div>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(realIndex)}
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
                              onCheckedChange={() => toggleBlockCalendar(realIndex)}
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
