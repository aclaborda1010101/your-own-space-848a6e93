import { useState, useCallback, useEffect, useMemo } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar, CalendarEvent } from "@/hooks/useCalendar";
import { EventDialog } from "@/components/calendar/EventDialog";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { CalendarViewSelector, CalendarView } from "@/components/calendar/CalendarViewSelector";
import { CalendarTypeFilter, EventType } from "@/components/calendar/CalendarTypeFilter";
import { CalendarLegend } from "@/components/calendar/CalendarLegend";
import { DayView } from "@/components/calendar/DayView";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { YearView } from "@/components/calendar/YearView";
import { cn } from "@/lib/utils";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Briefcase,
  Heart,
  Wallet,
  Clock,
  Loader2,
  GripVertical,
  RefreshCw,
  AlertTriangle,
  CloudOff,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  addMonths, 
  subMonths,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear
} from "date-fns";
import { es } from "date-fns/locale";

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/20 text-primary border-primary/30" },
  life: { icon: Heart, label: "Vida", color: "bg-success/20 text-success border-success/30" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/20 text-warning border-warning/30" },
  health: { icon: Heart, label: "Salud", color: "bg-destructive/20 text-destructive border-destructive/30" },
  family: { icon: Heart, label: "Familia", color: "bg-accent/20 text-accent border-accent/30" },
};

const CalendarPage = () => {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterTypes, setFilterTypes] = useState<EventType[]>([]);
  const [draggedTask, setDraggedTask] = useState<{
    id: string;
    title: string;
    duration: number;
    type: string;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);

  const { pendingTasks, completedTasks, loading: tasksLoading } = useTasks();
  const { 
    events, 
    loading: eventsLoading,
    syncing,
    createEvent, 
    updateEvent, 
    deleteEvent, 
    fetchEvents, 
    connected,
    needsReauth,
    lastSyncTime,
    reconnectGoogle,
  } = useCalendar();

  // Map completed tasks to calendar events
  const taskEvents: CalendarEvent[] = useMemo(() => {
    return completedTasks
      .filter(t => t.completedAt)
      .map(t => ({
        id: `task-${t.id}`,
        title: `✓ ${t.title}`,
        date: format(t.completedAt!, "yyyy-MM-dd"),
        time: format(t.completedAt!, "HH:mm"),
        duration: `${t.duration}`,
        type: t.type as CalendarEvent["type"],
        description: `Tarea completada. Creada: ${format(t.createdAt, "dd/MM/yyyy")}`,
      }));
  }, [completedTasks]);

  const allEvents = useMemo(() => [...events, ...taskEvents], [events, taskEvents]);

  const filteredEvents = useMemo(() => {
    if (filterTypes.length === 0) return allEvents;
    return allEvents.filter((event) => filterTypes.includes(event.type as EventType));
  }, [allEvents, filterTypes]);

  // Navigation handlers
  const handlePrev = () => {
    switch (view) {
      case "day": setCurrentDate(prev => addDays(prev, -1)); break;
      case "week": setCurrentDate(prev => subWeeks(prev, 1)); break;
      case "month": setCurrentDate(prev => subMonths(prev, 1)); break;
      case "year": setCurrentDate(prev => subYears(prev, 1)); break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case "day": setCurrentDate(prev => addDays(prev, 1)); break;
      case "week": setCurrentDate(prev => addWeeks(prev, 1)); break;
      case "month": setCurrentDate(prev => addMonths(prev, 1)); break;
      case "year": setCurrentDate(prev => addYears(prev, 1)); break;
    }
  };

  const handleToday = () => setCurrentDate(new Date());

  const getHeaderTitle = () => {
    switch (view) {
      case "day": return format(currentDate, "d 'de' MMMM yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return format(weekStart, "MMMM yyyy", { locale: es }).toUpperCase();
      case "month": return format(currentDate, "MMMM yyyy", { locale: es }).toUpperCase();
      case "year": return format(currentDate, "yyyy");
    }
  };

  // Drag and drop handlers
  const handleDragStart = (task: typeof draggedTask) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-primary/10");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-primary/10");
  };

  const handleDrop = async (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-primary/10");

    if (!draggedTask) return;

    if (!connected) {
      toast.error("Conecta Google Calendar para crear eventos");
      setDraggedTask(null);
      return;
    }

    const dropDateTime = new Date(day);
    dropDateTime.setHours(hour, 0, 0, 0);
    
    if (dropDateTime < new Date()) {
      toast.error("No puedes crear eventos en el pasado");
      setDraggedTask(null);
      return;
    }

    const time = `${hour.toString().padStart(2, '0')}:00`;
    
    await createEvent({
      title: draggedTask.title,
      time,
      duration: draggedTask.duration,
      description: `Creado desde JARVIS - Tarea: ${draggedTask.title}`,
    });

    setDraggedTask(null);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  };

  const handleSlotClick = (day: Date, hour: number) => {
    if (!connected) {
      toast.error("Conecta Google Calendar para crear eventos");
      return;
    }

    const slotDateTime = new Date(day);
    slotDateTime.setHours(hour, 0, 0, 0);
    
    if (slotDateTime < new Date()) {
      toast.error("No puedes crear eventos en el pasado");
      return;
    }

    setSelectedSlot({ date: day, hour });
    setCreateDialogOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleMonthClick = (date: Date) => {
    setCurrentDate(date);
    setView("month");
  };

  const handleCreateEvent = async (data: { title: string; time: string; duration: number; description?: string }) => {
    return createEvent(data);
  };

  const handleUpdateEvent = async (eventId: string, data: { title?: string; time?: string; duration?: number; description?: string }) => {
    return updateEvent({ eventId, ...data });
  };

  const handleDeleteEvent = async (eventId: string) => {
    return deleteEvent(eventId);
  };

  const fetchViewEvents = useCallback(() => {
    if (!connected) return;
    let start: Date, end: Date;
    switch (view) {
      case "day": start = currentDate; end = addDays(currentDate, 1); break;
      case "week": start = startOfWeek(currentDate, { weekStartsOn: 1 }); end = addDays(start, 7); break;
      case "month": start = startOfMonth(currentDate); end = endOfMonth(currentDate); break;
      case "year": start = startOfYear(currentDate); end = endOfYear(currentDate); break;
    }
    fetchEvents(start.toISOString(), end.toISOString());
  }, [connected, currentDate, view, fetchEvents]);

  useEffect(() => {
    fetchViewEvents();
  }, [fetchViewEvents]);

  const loading = tasksLoading || eventsLoading;

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-xs tracking-wider">CARGANDO CALENDARIO...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 space-y-3 sm:space-y-4 max-w-[1600px] mx-auto">
        <Breadcrumbs />
        
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground font-display">Calendario</h1>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {getHeaderTitle()}
                </p>
              </div>
            </div>

            {/* Nav arrows - always visible */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-xl">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday} className="h-8 text-xs rounded-xl border-border/50">
                Hoy
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 rounded-xl">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarViewSelector value={view} onChange={setView} />
            <CalendarTypeFilter selectedTypes={filterTypes} onChange={setFilterTypes} />
            
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchViewEvents()}
                disabled={syncing}
                className="h-8 w-8 rounded-xl"
                title={lastSyncTime ? `Última sync: ${lastSyncTime.toLocaleTimeString()}` : 'Sincronizar'}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              </Button>
              
              {syncing && (
                <span className="text-[10px] text-muted-foreground animate-pulse">
                  Sync...
                </span>
              )}
              {!syncing && lastSyncTime && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  <Check className="w-3 h-3 inline mr-0.5 text-success" />
                  {lastSyncTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        <CalendarLegend />

        <div className={cn(
          "grid gap-3 sm:gap-4",
          view === "year" ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-4"
        )}>
          {/* Tasks sidebar - hidden on mobile for calendar views */}
          {view !== "year" && (
            <Card className="xl:col-span-1 hidden sm:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2 font-mono tracking-wider">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  TAREAS
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Arrastra para crear bloques
                </p>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {pendingTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin tareas pendientes
                  </p>
                ) : (
                  pendingTasks.map((task) => {
                    const config = typeConfig[task.type as keyof typeof typeConfig] || typeConfig.work;
                    const TaskIcon = config.icon;
                    
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart({
                          id: task.id,
                          title: task.title,
                          duration: task.duration,
                          type: task.type,
                        })}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-border/30 glass-card-hover cursor-grab active:cursor-grabbing group"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-40 group-hover:opacity-100" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                              <TaskIcon className="w-2.5 h-2.5 mr-0.5" />
                              {config.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {task.duration}m
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          <Card className={cn(
            "overflow-hidden",
            view === "year" ? "" : "xl:col-span-3"
          )}>
            <CardContent className="p-0">
              {view === "day" && (
                <DayView
                  currentDate={currentDate}
                  events={filteredEvents}
                  onSlotClick={handleSlotClick}
                  onEventClick={handleEventClick}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                />
              )}
              {view === "week" && (
                <WeekView
                  weekStart={startOfWeek(currentDate, { weekStartsOn: 1 })}
                  events={filteredEvents}
                  onSlotClick={handleSlotClick}
                  onEventClick={handleEventClick}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                />
              )}
              {view === "month" && (
                <MonthView
                  currentDate={currentDate}
                  events={filteredEvents}
                  onDayClick={handleDayClick}
                  onEventClick={handleEventClick}
                />
              )}
              {view === "year" && (
                <YearView
                  currentDate={currentDate}
                  events={filteredEvents}
                  onMonthClick={handleMonthClick}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status cards */}
        {needsReauth && (
          <Card className="border-destructive/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Sesión expirada</p>
                    <p className="text-[10px] text-muted-foreground truncate">Reconecta Google Calendar</p>
                  </div>
                </div>
                <Button onClick={reconnectGoogle} variant="destructive" size="sm" className="h-7 text-xs rounded-lg flex-shrink-0">
                  Reconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!connected && !needsReauth && (
          <Card className="border-warning/20">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <CloudOff className="w-4 h-4 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Google Calendar desconectado</p>
                    <p className="text-[10px] text-muted-foreground truncate">Conecta para sincronizar eventos</p>
                  </div>
                </div>
                <Button onClick={reconnectGoogle} variant="outline" size="sm" className="h-7 text-xs rounded-lg flex-shrink-0">
                  Conectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <EventDialog
        event={selectedEvent}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />

      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateEvent}
        selectedDate={selectedSlot?.date || null}
        selectedHour={selectedSlot?.hour || null}
      />
    </>
  );
};

export default CalendarPage;
