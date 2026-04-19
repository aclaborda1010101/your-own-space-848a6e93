import { useState } from "react";
import { CalendarEvent } from "@/hooks/useCalendar";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const typeConfig = {
  work: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", dot: "bg-blue-400" },
  life: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  finance: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  health: { color: "bg-rose-500/20 text-rose-400 border-rose-500/30", dot: "bg-rose-400" },
  family: { color: "bg-violet-500/20 text-violet-400 border-violet-500/30", dot: "bg-violet-400" },
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
  const isMobile = useIsMobile();
  const today = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const dayStr = format(date, "yyyy-MM-dd");
    return events.filter((event) => event.date === dayStr);
  };

  const weekDayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const handleDayClick = (date: Date) => {
    if (isMobile) {
      setSelectedDay(date);
    }
    onDayClick(date);
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="p-2 sm:p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekDayNames.map((name) => (
          <div
            key={name}
            className="p-1 sm:p-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground"
          >
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
              onClick={() => handleDayClick(date)}
              className={cn(
                "rounded-lg border transition-colors cursor-pointer relative",
                // Mobile: aspect-square + dots; Desktop: alto fijo + lista
                isMobile
                  ? "aspect-square p-1 flex flex-col items-center justify-start"
                  : "min-h-[100px] p-2",
                isCurrentMonth
                  ? "border-border hover:border-primary/30"
                  : "border-transparent opacity-50",
                isToday && "bg-primary/10 border-primary/40 ring-1 ring-primary/30",
                isPast && "opacity-60"
              )}
            >
              <p
                className={cn(
                  "font-medium",
                  isMobile ? "text-xs sm:text-sm mt-0.5" : "text-sm mb-1",
                  isToday
                    ? "text-primary font-semibold"
                    : isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {format(date, "d")}
              </p>

              {isMobile ? (
                /* Mobile: dots de colores debajo */
                <div className="flex gap-0.5 mt-auto mb-1 justify-center flex-wrap max-w-full">
                  {dayEvents.slice(0, 4).map((event) => {
                    const cfg =
                      typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                    return (
                      <span
                        key={event.id}
                        className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)}
                      />
                    );
                  })}
                  {dayEvents.length > 4 && (
                    <span className="text-[8px] text-muted-foreground leading-none">
                      +{dayEvents.length - 4}
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const eventConfig =
                      typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className={cn(
                          "text-xs p-1 rounded border truncate cursor-pointer hover:ring-1 hover:ring-primary/50",
                          eventConfig.color
                        )}
                        title={event.title}
                      >
                        {event.time.slice(0, 5)} {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{dayEvents.length - 3} más
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: bottom sheet con eventos del día */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="capitalize">
              {selectedDay && format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay eventos este día.
              </p>
            ) : (
              selectedDayEvents.map((event) => {
                const cfg =
                  typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      onEventClick(event);
                      setSelectedDay(null);
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition hover:ring-1 hover:ring-primary/40",
                      cfg.color
                    )}
                  >
                    <p className="text-xs font-mono opacity-80">
                      {event.time.slice(0, 5)}
                    </p>
                    <p className="font-medium text-sm">{event.title}</p>
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
