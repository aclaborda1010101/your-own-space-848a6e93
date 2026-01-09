import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Briefcase, Heart, Brain, Users, RefreshCw, ExternalLink, AlertCircle, ChevronDown } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const typeConfig = {
  work: { 
    icon: Briefcase, 
    color: "bg-primary/10 text-primary border-primary/20",
    label: "Trabajo"
  },
  life: { 
    icon: Brain, 
    color: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    label: "Vida"
  },
  health: { 
    icon: Heart, 
    color: "bg-success/10 text-success border-success/20",
    label: "Salud"
  },
  family: { 
    icon: Users, 
    color: "bg-warning/10 text-warning border-warning/20",
    label: "Familia"
  },
};

export const AgendaCard = () => {
  const { events, loading, connected, needsReauth, fetchEvents, reconnectGoogle } = useGoogleCalendar();
  const [isOpen, setIsOpen] = useState(true);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  const isEventPast = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours < currentHour || (hours === currentHour && minutes < currentMinutes);
  };

  const isEventCurrent = (time: string) => {
    const [hours] = time.split(':').map(Number);
    return hours === currentHour;
  };

  if (!connected || needsReauth) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="border border-border bg-card rounded-lg">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm sm:text-base font-semibold text-foreground">Agenda de Hoy</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-foreground font-medium">
                    {needsReauth ? 'Sesión de Google expirada' : 'Conecta tu Google Calendar'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {needsReauth 
                      ? 'Vuelve a conectar para sincronizar tus eventos'
                      : 'Inicia sesión con Google para ver y crear eventos'}
                  </p>
                </div>
                <Button onClick={reconnectGoogle} className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {needsReauth ? 'Reconectar' : 'Conectar Google Calendar'}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border bg-card rounded-lg">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:text-primary transition-colors flex-1">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-foreground">Agenda de Hoy</span>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200 ml-auto", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchEvents()}
              disabled={loading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant="outline" className="text-xs border-border text-muted-foreground hidden sm:flex">
              {now.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
            </Badge>
          </div>
        </div>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="w-16 h-10" />
                    <Skeleton className="w-0.5 h-12" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay eventos para hoy</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Los eventos aparecerán aquí automáticamente
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const isPast = isEventPast(event.time);
                  const isCurrent = isEventCurrent(event.time);
                  const TypeIcon = typeConfig[event.type].icon;

                  return (
                    <div
                      key={event.id}
                      className={`group flex items-center gap-4 p-3 rounded-lg border transition-all hover:border-primary/30 ${
                        isCurrent 
                          ? "bg-primary/5 border-primary/30" 
                          : isPast 
                            ? "opacity-50 border-border" 
                            : "border-border hover:bg-card"
                      }`}
                    >
                      {/* Time */}
                      <div className="w-16 text-center">
                        <p className={`text-sm font-mono font-medium ${isCurrent ? "text-primary" : "text-foreground"}`}>
                          {event.time}
                        </p>
                        <p className="text-xs text-muted-foreground">{event.duration}</p>
                      </div>

                      {/* Divider */}
                      <div className={`w-0.5 h-12 rounded-full ${isCurrent ? "bg-primary" : "bg-border"}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isPast ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${typeConfig[event.type].color}`}
                          >
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {typeConfig[event.type].label}
                          </Badge>
                          {event.location && (
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                              📍 {event.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                        {isCurrent && (
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
