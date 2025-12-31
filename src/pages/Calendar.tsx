import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar, CalendarEvent } from "@/hooks/useGoogleCalendar";
import { EventDialog } from "@/components/calendar/EventDialog";
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
  Edit2
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/20 text-primary border-primary/30" },
  life: { icon: Heart, label: "Vida", color: "bg-success/20 text-success border-success/30" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/20 text-warning border-warning/30" },
  health: { icon: Heart, label: "Salud", color: "bg-success/20 text-success border-success/30" },
  family: { icon: Heart, label: "Familia", color: "bg-warning/20 text-warning border-warning/30" },
};

const timeSlots = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

const CalendarPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [draggedTask, setDraggedTask] = useState<{
    id: string;
    title: string;
    duration: number;
    type: string;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const today = new Date();

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

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

    // Check if trying to drop on a past date/time
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

  const handleUpdateEvent = async (eventId: string, data: { title?: string; time?: string; duration?: number; description?: string }) => {
    return updateEvent({ eventId, ...data });
  };

  const handleDeleteEvent = async (eventId: string) => {
    return deleteEvent(eventId);
  };

  const getEventsForSlot = (day: Date, hour: number): CalendarEvent[] => {
    return events.filter(event => {
      const [eventHour] = event.time.split(':').map(Number);
      // For simplicity, we're showing today's events - in a real app you'd filter by date
      return eventHour === hour && isSameDay(day, today);
    });
  };

  const loading = tasksLoading || eventsLoading;

  if (loading) {
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
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
                  {format(currentWeekStart, "MMMM yyyy", { locale: es }).toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevWeek} className="border-border">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday} className="border-border">
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextWeek} className="border-border">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchEvents}
                className="h-8 w-8"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Tasks Panel */}
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

            {/* Calendar Grid */}
            <Card className="border-border bg-card xl:col-span-3 overflow-hidden">
              <CardContent className="p-0">
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
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, hour)}
                                className={`min-h-[60px] p-1 border-r border-border last:border-r-0 transition-colors ${
                                  isToday ? "bg-primary/5" : ""
                                } ${isPast ? "opacity-50" : "hover:bg-muted/50"}`}
                              >
                                {slotEvents.map((event) => {
                                  const eventConfig = typeConfig[event.type as keyof typeof typeConfig] || typeConfig.work;
                                  return (
                                    <div
                                      key={event.id}
                                      onClick={() => handleEventClick(event)}
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
    </div>
  );
};

export default CalendarPage;
