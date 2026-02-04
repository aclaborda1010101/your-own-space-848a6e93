import { CalendarEvent } from "@/hooks/useCalendar";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit2, List, Grid } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const timeSlots = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

const typeConfig = {
  work: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  life: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  finance: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  health: { color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  family: { color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
};

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSlotClick: (date: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDrop: (e: React.DragEvent, date: Date, hour: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}

export const DayView = ({
  currentDate,
  events,
  onSlotClick,
  onEventClick,
  onDrop,
  onDragOver,
  onDragLeave,
}: DayViewProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  const dayStr = format(currentDate, 'yyyy-MM-dd');

  const dayEvents = events.filter(event => event.date === dayStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const getEventsForHour = (hour: number): CalendarEvent[] => {
    return events.filter(event => {
      const [eventHour] = event.time.split(':').map(Number);
      return eventHour === hour && event.date === dayStr;
    });
  };

  return (
    <div className="overflow-y-auto max-h-[600px]">
      <div className="sticky top-0 bg-card z-10 p-4 border-b border-border flex items-center justify-between">
        <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
          {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {viewMode === 'list' ? (
        // List View (Apple style)
        <div className="p-4 space-y-2">
          {dayEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No hay eventos programados</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => onSlotClick(currentDate, 9)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir evento
              </Button>
            </div>
          ) : (
            dayEvents.map((event) => {
              const eventConfig = typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
              const [hour] = event.time.split(':').map(Number);
              const isPast = isToday && hour < today.getHours();
              
              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:ring-2 hover:ring-primary/50 group",
                    eventConfig.color,
                    isPast && "opacity-60"
                  )}
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-mono font-medium text-sm">{event.time}</p>
                    <p className="text-xs opacity-70">{event.duration}min</p>
                  </div>
                  <div className="w-1 h-10 rounded-full bg-current opacity-30" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    {event.description && (
                      <p className="text-xs opacity-70 truncate">{event.description}</p>
                    )}
                  </div>
                  <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              );
            })
          )}
          
          {dayEvents.length > 0 && !isSameDay(currentDate, today) || (isToday && today.getHours() < 20) ? (
            <Button
              variant="ghost"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => onSlotClick(currentDate, Math.max(9, today.getHours() + 1))}
            >
              <Plus className="w-4 h-4 mr-2" />
              Añadir evento
            </Button>
          ) : null}
        </div>
      ) : (
        // Grid View (compact)
        <div className="p-4 space-y-0.5">
          {timeSlots.map((hour) => {
            const slotEvents = getEventsForHour(hour);
            const isPast = currentDate < today || (isToday && hour < today.getHours());

            return (
              <div
                key={hour}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, currentDate, hour)}
                onClick={() => slotEvents.length === 0 && !isPast && onSlotClick(currentDate, hour)}
                className={cn(
                  "flex gap-3 py-1.5 px-2 rounded transition-colors group/slot",
                  isPast ? "opacity-40" : "hover:bg-muted/50 cursor-pointer"
                )}
              >
                <span className="text-xs font-mono text-muted-foreground w-10 shrink-0 pt-0.5">
                  {hour.toString().padStart(2, '0')}:00
                </span>
                <div className="flex-1 min-h-[28px] border-l border-border/50 pl-3">
                  {slotEvents.length === 0 && !isPast && (
                    <div className="h-full flex items-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                      <Plus className="w-3 h-3 text-muted-foreground mr-1" />
                      <span className="text-xs text-muted-foreground">Añadir</span>
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
                          "text-xs py-1 px-2 rounded border truncate cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all",
                          eventConfig.color
                        )}
                      >
                        {event.title} · {event.duration}min
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
