import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun, Moon, CloudSun, Sparkles, ArrowRight,
  Activity, Heart, BedDouble, Flame,
  CheckSquare, MessageSquare, CalendarDays, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useJarvisWhoopData } from "@/hooks/useJarvisWhoopData";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { Task } from "@/hooks/useTasks";
import type { CalendarEvent } from "@/hooks/useCalendar";

interface PendingContact {
  id: string;
  name: string;
  action: string;
  channel?: string;
}

interface CommandCenterCardProps {
  tasks: Task[];
  events: CalendarEvent[];
  onToggleComplete: (id: string) => void;
}

export const CommandCenterCard = ({ tasks, events, onToggleComplete }: CommandCenterCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { data: whoopData, isLoading: whoopLoading } = useJarvisWhoopData();
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  // Greeting logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 7) return "Buenas noches";
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 12) return <Sun className="h-5 w-5 text-warning" />;
    if (hour >= 12 && hour < 20) return <CloudSun className="h-5 w-5 text-warning" />;
    return <Moon className="h-5 w-5 text-primary" />;
  };

  // Fetch pending contacts
  useEffect(() => {
    const fetchPendingContacts = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("people_contacts")
          .select("id, name, personality_profile, brain, wa_id")
          .eq("user_id", user.id)
          .eq("in_strategic_network", true)
          .not("personality_profile", "is", null)
          .limit(50);

        if (error) throw error;

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const pending: PendingContact[] = [];

        for (const contact of data || []) {
          const pp = contact.personality_profile as any;
          if (!pp) continue;

          const scopes = ["profesional", "personal", "familiar"];
          for (const scope of scopes) {
            const pa = pp?.[scope]?.proxima_accion;
            if (pa?.que) {
              const cuando = pa.cuando ? new Date(pa.cuando) : null;
              if (!cuando || cuando <= today) {
                const channel = contact.wa_id ? "WhatsApp" : "Mensaje";
                pending.push({
                  id: contact.id,
                  name: contact.name,
                  action: pa.que.substring(0, 60),
                  channel,
                });
                break; // one per contact
              }
            }
          }
        }
        setPendingContacts(pending.slice(0, 3));
      } catch (err) {
        console.error("Error fetching pending contacts:", err);
      } finally {
        setContactsLoading(false);
      }
    };
    fetchPendingContacts();
  }, [user]);

  const userName = profile?.name || "Usuario";
  const formattedDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
  const formattedTime = format(new Date(), "HH:mm");

  // Priority tasks (P0/P1, not completed, top 3)
  const priorityTasks = tasks
    .filter(t => !t.completed && (t.priority === "P0" || t.priority === "P1"))
    .sort((a, b) => {
      if (a.priority === "P0" && b.priority !== "P0") return -1;
      if (b.priority === "P0" && a.priority !== "P0") return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 3);

  const totalPending = tasks.filter(t => !t.completed).length;

  // Today's events
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayEvents = events
    .filter(e => e.date === todayStr)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 5);

  // Recovery color
  const getRecoveryColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 67) return "text-success";
    if (score >= 34) return "text-warning";
    return "text-destructive";
  };

  const getRecoveryBg = (score: number | null) => {
    if (score === null) return "bg-muted/50 border-border";
    if (score >= 67) return "bg-success/10 border-success/20";
    if (score >= 34) return "bg-warning/10 border-warning/20";
    return "bg-destructive/10 border-destructive/20";
  };

  return (
    <Card className="border-border/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent pointer-events-none" />

      <CardContent className="p-0 relative">
        {/* Header: Greeting + Time */}
        <div className="flex items-start justify-between gap-4 p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
              {getTimeIcon()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {getGreeting()}, <span className="text-primary">{userName}</span>
              </h2>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{formattedDate}</p>
            </div>
          </div>
          <span className="text-xl font-bold font-mono text-foreground/70 tabular-nums shrink-0 pt-1">
            {formattedTime}
          </span>
        </div>

        {/* Section 1: Health (Whoop) */}
        <div className="px-4 py-2.5 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salud</span>
          </div>
          {whoopLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-16" />
            </div>
          ) : whoopData ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn("gap-1 py-1 px-2.5", getRecoveryBg(whoopData.recovery_score), getRecoveryColor(whoopData.recovery_score))}>
                <Heart className="h-3 w-3" />
                <span className="text-xs font-medium">Recovery {whoopData.recovery_score ?? "–"}%</span>
              </Badge>
              {whoopData.hrv !== null && (
                <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-primary/10 border-primary/20 text-primary">
                  <Activity className="h-3 w-3" />
                  <span className="text-xs font-medium">HRV {whoopData.hrv}ms</span>
                </Badge>
              )}
              {whoopData.sleep_hours !== null && (
                <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-primary/10 border-primary/20 text-primary">
                  <BedDouble className="h-3 w-3" />
                  <span className="text-xs font-medium">{whoopData.sleep_hours.toFixed(1)}h sueño</span>
                </Badge>
              )}
              {whoopData.strain !== null && (
                <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-muted/50 border-border text-muted-foreground">
                  <Flame className="h-3 w-3" />
                  <span className="text-xs font-medium">Strain {whoopData.strain.toFixed(1)}</span>
                </Badge>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/health")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Sin datos Whoop · Ver sección salud →
            </button>
          )}
        </div>

        {/* Section 2: Priority Tasks */}
        <div className="px-4 py-2.5 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tareas prioritarias</span>
            </div>
            {totalPending > 0 && (
              <button
                onClick={() => navigate("/tasks")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                {totalPending} pendientes <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          {priorityTasks.length > 0 ? (
            <div className="space-y-1.5">
              {priorityTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2.5 group">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => onToggleComplete(task.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      task.priority === "P0"
                        ? "bg-destructive/10 border-destructive/20 text-destructive"
                        : "bg-warning/10 border-warning/20 text-warning"
                    )}
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-success" />
              <span className="text-xs text-success">Sin tareas urgentes</span>
            </div>
          )}
        </div>

        {/* Section 3: Pending Contacts */}
        <div className="px-4 py-2.5 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contactos pendientes</span>
            </div>
            <button
              onClick={() => navigate("/strategic-network")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Red <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {contactsLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : pendingContacts.length > 0 ? (
            <div className="space-y-1.5">
              {pendingContacts.map(contact => (
                <div key={contact.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{contact.name}</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{contact.action}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-success/10 border-success/20 text-success">
                    {contact.channel}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sin acciones pendientes</span>
          )}
        </div>

        {/* Section 4: Today's Calendar */}
        <div className="px-4 py-2.5 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hoy</span>
            </div>
            <button
              onClick={() => navigate("/calendar")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Calendario <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {todayEvents.length > 0 ? (
            <div className="space-y-1.5">
              {todayEvents.map(event => (
                <div key={event.id} className="flex items-center gap-2 text-sm">
                  <span className="text-xs font-mono text-muted-foreground w-11 shrink-0">
                    {event.allDay ? "Todo" : event.time?.substring(0, 5)}
                  </span>
                  <span className="text-foreground truncate">{event.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sin eventos hoy</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
