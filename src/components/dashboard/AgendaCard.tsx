import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Briefcase, Heart, Brain, Users } from "lucide-react";

interface AgendaEvent {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "work" | "life" | "health" | "family";
  completed?: boolean;
}

const mockEvents: AgendaEvent[] = [
  { id: "1", title: "Deep Work - Proyecto Cliente A", time: "09:00", duration: "90 min", type: "work" },
  { id: "2", title: "Entrenamiento", time: "10:30", duration: "45 min", type: "health" },
  { id: "3", title: "Reunión Equipo", time: "12:00", duration: "60 min", type: "work" },
  { id: "4", title: "Almuerzo con Familia", time: "14:00", duration: "60 min", type: "family" },
  { id: "5", title: "Admin - Emails y tareas", time: "15:30", duration: "30 min", type: "work" },
  { id: "6", title: "Meditación", time: "17:00", duration: "10 min", type: "life" },
];

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
  const now = new Date();
  const currentHour = now.getHours();

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            Agenda de Hoy
          </CardTitle>
          <Badge variant="outline" className="text-xs border-border text-muted-foreground">
            {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockEvents.map((event, index) => {
            const eventHour = parseInt(event.time.split(":")[0]);
            const isPast = eventHour < currentHour;
            const isCurrent = eventHour === currentHour;
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
                  </div>
                </div>

                {/* Current Indicator */}
                {isCurrent && (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
