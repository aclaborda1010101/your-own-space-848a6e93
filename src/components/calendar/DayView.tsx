import { CalendarEvent } from "@/hooks/useGoogleCalendar";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit2 } from "lucide-react";

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
  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  const dayStr = format(currentDate, 'yyyy-MM-dd');

  const getEventsForHour = (hour: number): CalendarEvent[] => {
    return events.filter(event => {
      const [eventHour] = event.time.split(':').map(Number);
      return eventHour === hour && event.date === dayStr;
    });
  };

  return (
    <div className="overflow-y-auto max-h-[600px]">
      <div className="sticky top-0 bg-card z-10 p-4 border-b border-border text-center">
        <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
          {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>
      
      <div className="p-4 space-y-1">
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
              className={`flex gap-4 p-3 rounded-lg border border-border transition-colors group/slot ${
                isPast ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer"
              }`}
            >
              <span className="text-sm font-mono text-muted-foreground w-14 shrink-0">
                {hour.toString().padStart(2, '0')}:00
              </span>
              <div className="flex-1 min-h-[40px]">
                {slotEvents.length === 0 && !isPast && (
                  <div className="h-full flex items-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground mr-2" />
                    <span className="text-xs text-muted-foreground">Añadir evento</span>
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
                      className={`p-3 rounded-lg border ${eventConfig.color} cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all group relative`}
                    >
                      <p className="font-medium">{event.title}</p>
                      <p className="text-xs opacity-70 mt-1">{event.time} · {event.duration}min</p>
                      <Edit2 className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
