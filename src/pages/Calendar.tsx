import { useState, useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { JarvisVoiceButton } from "@/components/voice/JarvisVoiceButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar, CalendarEvent } from "@/hooks/useGoogleCalendar";
import { useSidebarState } from "@/hooks/useSidebarState";
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
  work: { icon: Briefcase, label: "Trabajo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  life: { icon: Heart, label: "Vida", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  health: { icon: Heart, label: "Salud", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  family: { icon: Heart, label: "Familia", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
};

const CalendarPage = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
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

  const { pendingTasks, loading: tasksLoading } = useTasks();
  const { 
    events, 
    loading: eventsLoading, 
    createEvent, 
    updateEvent, 
    deleteEvent, 
    fetchEvents, 
    connected 
  } = useGoogleCalendar();

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (filterTypes.length === 0) return events;
    return events.filter((event) => filterTypes.includes(event.type as EventType));
  }, [events, filterTypes]);

  // Navigation handlers
  const handlePrev = () => {
    switch (view) {
      case "day":
        setCurrentDate(prev => addDays(prev, -1));
        break;
      case "week":
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case "month":
        setCurrentDate(prev => subMonths(prev, 1));
        break;
      case "year":
        setCurrentDate(prev => subYears(prev, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case "day":
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case "week":
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case "month":
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case "year":
        setCurrentDate(prev => addYears(prev, 1));
        break;
    }
  };

  const handleToday = () => setCurrentDate(new Date());

  const getHeaderTitle = () => {
    switch (view) {
      case "day":
        return format(currentDate, "d 'de' MMMM yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return format(weekStart, "MMMM yyyy", { locale: es }).toUpperCase();
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: es }).toUpperCase();
      case "year":
        return format(currentDate, "yyyy");
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

  // Fetch events based on view
  const fetchViewEvents = useCallback(() => {
    if (!connected) return;

    let start: Date, end: Date;

    switch (view) {
      case "day":
        start = currentDate;
        end = addDays(currentDate, 1);
        break;
      case "week":
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = addDays(start, 7);
        break;
      case "month":
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        break;
      case "year":
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
        break;
    }

    fetchEvents(start.toISOString(), end.toISOString());
  }, [connected, currentDate, view, fetchEvents]);

  useEffect(() => {
    fetchViewEvents();
  }, [fetchViewEvents]);

  const loading = tasksLoading || eventsLoading;

  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">CARGANDO CALENDARIO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {getHeaderTitle()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CalendarViewSelector value={view} onChange={setView} />
              <CalendarTypeFilter selectedTypes={filterTypes} onChange={setFilterTypes} />
              
              <div className="flex items-center gap-1 ml-2">
                <Button variant="outline" size="sm" onClick={handlePrev} className="border-border">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday} className="border-border">
                  Hoy
                </Button>
                <Button variant="outline" size="sm" onClick={handleNext} className="border-border">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchViewEvents()}
                  className="h-8 w-8"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Color Legend */}
          <CalendarLegend />

          <div className={cn(
            "grid gap-6",
            view === "year" ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-4"
          )}>
            {/* Tasks Panel - hide on year view */}
            {view !== "year" && (
              <Card className="border-border bg-card xl:col-span-1">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    Tareas pendientes
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Arrastra para crear bloques
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                  {pendingTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay tareas pendientes
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
                          className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/30 cursor-grab active:cursor-grabbing transition-all group"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`text-xs ${config.color}`}>
                                <TaskIcon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
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

            {/* Calendar Views */}
            <Card className={cn(
              "border-border bg-card overflow-hidden",
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

          {/* Connection Notice */}
          {!connected && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Google Calendar no conectado</p>
                    <p className="text-xs text-muted-foreground">
                      Conecta tu cuenta para ver eventos y crear bloques automáticamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Event Edit Dialog */}
      <EventDialog
        event={selectedEvent}
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateEvent}
        selectedDate={selectedSlot?.date || null}
        selectedHour={selectedSlot?.hour || null}
      />
      
      <JarvisVoiceButton />
    </div>
  );
};

export default CalendarPage;
