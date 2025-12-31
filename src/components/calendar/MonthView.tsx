import { CalendarEvent } from "@/hooks/useGoogleCalendar";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  isSameDay 
} from "date-fns";
import { es } from "date-fns/locale";

const typeConfig = {
  work: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  life: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  finance: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  health: { color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  family: { color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
};

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export const MonthView = ({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: MonthViewProps) => {
  const today = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const dayStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => event.date === dayStr);
  };

  const weekDayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekDayNames.map((name) => (
          <div key={name} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {name.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isToday = isSameDay(date, today);
          const dayEvents = getEventsForDay(date);
          const isPast = date < today && !isToday;

          return (
            <div
              key={index}
              onClick={() => onDayClick(date)}
              className={`min-h-[100px] p-2 rounded-lg border transition-colors cursor-pointer ${
                isCurrentMonth 
                  ? "border-border hover:border-primary/30" 
                  : "border-transparent opacity-50"
              } ${isToday ? "bg-primary/5 border-primary/30" : ""} ${
                isPast ? "opacity-60" : ""
              }`}
            >
              <p className={`text-sm font-medium mb-1 ${
                isToday ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
              }`}>
                {format(date, "d")}
              </p>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => {
                  const eventConfig = typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className={`text-xs p-1 rounded border ${eventConfig.color} truncate cursor-pointer hover:ring-1 hover:ring-primary/50`}
                      title={event.title}
                    >
                      {event.time.slice(0, 5)} {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{dayEvents.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
