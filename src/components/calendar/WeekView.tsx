import { CalendarEvent } from "@/hooks/useCalendar";
import { format, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit2, List, Grid } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const timeSlots = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

const typeConfig = {
  work: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  life: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  finance: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  health: { color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  family: { color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
};

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  onSlotClick: (date: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDrop: (e: React.DragEvent, date: Date, hour: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}

export const WeekView = ({
  weekStart,
  events,
  onSlotClick,
  onEventClick,
  onDrop,
  onDragOver,
  onDragLeave,
}: WeekViewProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(event => event.date === dayStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getEventsForSlot = (day: Date, hour: number): CalendarEvent[] => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(event => {
      const [eventHour] = event.time.split(':').map(Number);
      return eventHour === hour && event.date === dayStr;
    });
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Week Header with View Toggle */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card sticky top-0 z-20">
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-1" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4 mr-1" />
              Horario
            </Button>
          </div>
        </div>

        {viewMode === 'list' ? (
          // List View (Apple style - events per day)
          <div className="grid grid-cols-7 divide-x divide-border">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              const dayEvents = getEventsForDay(day);
              
              return (
                <div key={i} className={cn("min-h-[500px]", isToday && "bg-primary/5")}>
                  {/* Day Header */}
                  <div className={cn(
                    "p-2 text-center border-b border-border sticky top-12 z-10 bg-card",
                    isToday && "bg-primary/10"
                  )}>
                    <p className={cn(
                      "text-xs font-medium",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(day, "EEE", { locale: es }).toUpperCase()}
                    </p>
                    <p className={cn(
                      "text-lg font-bold",
                      isToday ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </p>
                  </div>
                  
                  {/* Events List */}
                  <ScrollArea className="h-[440px]">
                    <div className="p-1.5 space-y-1">
                      {dayEvents.length === 0 ? (
                        <button
                          onClick={() => onSlotClick(day, 9)}
                          className="w-full py-6 text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Plus className="w-4 h-4 mx-auto mb-1" />
                          Añadir
                        </button>
                      ) : (
                        <>
                          {dayEvents.map((event) => {
                            const eventConfig = typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                            return (
                              <div
                                key={event.id}
                                onClick={() => onEventClick(event)}
                                className={cn(
                                  "p-1.5 rounded text-xs cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all border",
                                  eventConfig.color
                                )}
                              >
                                <p className="font-mono text-[10px] opacity-70">{event.time}</p>
                                <p className="font-medium truncate">{event.title}</p>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => onSlotClick(day, Math.max(9, today.getHours() + 1))}
                            className="w-full py-2 text-center text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Plus className="w-3 h-3 mx-auto" />
                          </button>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        ) : (
          // Grid View (compact time slots)
          <>
            {/* Days Header */}
            <div className="grid grid-cols-8 border-b border-border sticky top-12 z-10 bg-card">
              <div className="p-2 text-center text-xs text-muted-foreground font-mono border-r border-border">
                
              </div>
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today);
                return (
                  <div 
                    key={i} 
                    className={cn(
                      "p-2 text-center border-r border-border last:border-r-0",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <p className={cn(
                      "text-xs font-medium",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(day, "EEE", { locale: es }).toUpperCase()}
                    </p>
                    <p className={cn(
                      "text-sm font-bold",
                      isToday ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Time Grid - Compact */}
            <div className="max-h-[500px] overflow-y-auto">
              {timeSlots.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-border/50 last:border-b-0">
                  <div className="py-1 px-1 text-center text-[10px] text-muted-foreground font-mono border-r border-border flex items-center justify-center">
                    {hour.toString().padStart(2, '0')}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const isToday = isSameDay(day, today);
                    const slotEvents = getEventsForSlot(day, hour);
                    const isPast = day < today || (isToday && hour < today.getHours());
                    
                    return (
                      <div
                        key={dayIndex}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, day, hour)}
                        onClick={() => slotEvents.length === 0 && !isPast && onSlotClick(day, hour)}
                        className={cn(
                          "min-h-[32px] p-0.5 border-r border-border/50 last:border-r-0 transition-colors group/slot",
                          isToday && "bg-primary/5",
                          isPast ? "opacity-40" : "hover:bg-muted/50 cursor-pointer"
                        )}
                      >
                        {slotEvents.length === 0 && !isPast && (
                          <div className="w-full h-full flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                            <Plus className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                        {slotEvents.map((event) => {
                          const eventConfig = typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick(event);
                              }}
                              className={cn(
                                "text-[10px] p-1 rounded border truncate cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all",
                                eventConfig.color
                              )}
                              title={`${event.title} - ${event.time}`}
                            >
                              {event.title}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
