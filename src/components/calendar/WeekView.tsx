import { CalendarEvent } from "@/hooks/useGoogleCalendar";
import { format, addDays, isSameDay } from "date-fns";
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
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

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
        {/* Week Header */}
        <div className="grid grid-cols-8 border-b border-border">
          <div className="p-3 text-center text-xs text-muted-foreground font-mono border-r border-border">
            HORA
          </div>
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div 
                key={i} 
                className={`p-3 text-center border-r border-border last:border-r-0 ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "EEE", { locale: es }).toUpperCase()}
                </p>
                <p className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                  {format(day, "d")}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-border last:border-b-0">
              <div className="p-2 text-center text-xs text-muted-foreground font-mono border-r border-border flex items-center justify-center">
                {hour.toString().padStart(2, '0')}:00
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
                    className={`min-h-[60px] p-1 border-r border-border last:border-r-0 transition-colors group/slot ${
                      isToday ? "bg-primary/5" : ""
                    } ${isPast ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer"}`}
                  >
                    {slotEvents.length === 0 && !isPast && (
                      <div className="w-full h-full flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4 text-muted-foreground" />
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
                          className={`text-xs p-1.5 rounded border ${eventConfig.color} truncate mb-1 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all group relative`}
                          title={`${event.title} - Click para editar`}
                        >
                          <span className="truncate">{event.title}</span>
                          <Edit2 className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
