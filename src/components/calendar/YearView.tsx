import { CalendarEvent } from "@/hooks/useCalendar";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths,
  isSameMonth, 
  isSameDay,
  startOfYear
} from "date-fns";
import { es } from "date-fns/locale";

interface YearViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onMonthClick: (date: Date) => void;
}

export const YearView = ({
  currentDate,
  events,
  onMonthClick,
}: YearViewProps) => {
  const today = new Date();
  const yearStart = startOfYear(currentDate);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  const getEventsForDay = (date: Date): number => {
    const dayStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => event.date === dayStr).length;
  };

  const weekDayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const days: Date[] = [];
        let day = calendarStart;
        while (day <= calendarEnd) {
          days.push(day);
          day = addDays(day, 1);
        }

        const isCurrentMonth = isSameMonth(month, today);

        return (
          <div
            key={month.toISOString()}
            onClick={() => onMonthClick(month)}
            className={`p-3 rounded-lg border border-border cursor-pointer transition-all hover:border-primary/30 hover:bg-muted/30 ${
              isCurrentMonth ? "ring-1 ring-primary/30" : ""
            }`}
          >
            <p className={`text-sm font-semibold mb-2 text-center ${
              isCurrentMonth ? "text-primary" : "text-foreground"
            }`}>
              {format(month, "MMMM", { locale: es })}
            </p>
            
            {/* Mini week headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekDayNames.map((name) => (
                <div key={name} className="text-[10px] text-center text-muted-foreground">
                  {name}
                </div>
              ))}
            </div>

            {/* Mini calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((date, index) => {
                const isInMonth = isSameMonth(date, month);
                const isToday = isSameDay(date, today);
                const eventCount = getEventsForDay(date);

                return (
                  <div
                    key={index}
                    className={`aspect-square flex items-center justify-center text-[10px] rounded ${
                      !isInMonth ? "opacity-30" : ""
                    } ${isToday ? "bg-primary text-primary-foreground font-bold" : ""} ${
                      eventCount > 0 && !isToday ? "bg-primary/20 text-primary font-medium" : ""
                    }`}
                  >
                    {format(date, "d")}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
