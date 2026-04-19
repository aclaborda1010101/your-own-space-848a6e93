import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun, Moon, CloudSun, Sparkles, ArrowRight,
  Activity, Heart, BedDouble, Flame,
  CheckSquare, MessageSquare, CalendarDays,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useJarvisWhoopData } from "@/hooks/useJarvisWhoopData";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 7) return "Buenas noches";
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 12) return <Sun className="h-5 w-5" />;
    if (hour >= 12 && hour < 20) return <CloudSun className="h-5 w-5" />;
    return <Moon className="h-5 w-5" />;
  };

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
                break;
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

  const priorityTasks = tasks
    .filter(t => !t.completed && (t.priority === "P0" || t.priority === "P1"))
    .sort((a, b) => {
      if (a.priority === "P0" && b.priority !== "P0") return -1;
      if (b.priority === "P0" && a.priority !== "P0") return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 3);

  const totalPending = tasks.filter(t => !t.completed).length;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayEvents = events
    .filter(e => e.date === todayStr)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 5);

  const getRecoveryColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 67) return "text-success";
    if (score >= 34) return "text-warning";
    return "text-destructive";
  };

  const getRecoveryBg = (score: number | null) => {
    if (score === null) return "bg-muted/30 border-border/50";
    if (score >= 67) return "bg-success/10 border-success/30";
    if (score >= 34) return "bg-warning/10 border-warning/30";
    return "bg-destructive/10 border-destructive/30";
  };

  return (
    <Card className="holo-card holo-ring overflow-hidden relative border-0 bg-transparent animate-holo-fade-in">
      {/* Ambient glow wash */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
      {/* Scanline overlay */}
      <div className="absolute inset-0 bg-scanlines opacity-40 pointer-events-none" />

      <CardContent className="p-0 relative">
        {/* ===== HERO HEADER ===== */}
        <div className="relative px-4 sm:px-7 pt-5 pb-4 sm:pb-5 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              {/* Time badge — sin dot pulsante */}
              <div className="relative shrink-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/30 flex items-center justify-center text-primary shadow-glow-primary">
                  {getTimeIcon()}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-primary/90 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    JARVIS · Online
                  </span>
                </div>
                <h2 className="font-display text-xl sm:text-3xl font-bold leading-tight tracking-tight truncate">
                  <span className="whitespace-nowrap">{getGreeting()},</span>{" "}
                  <span className="holo-text">{userName}</span>
                </h2>
                <p className="text-[11px] sm:text-sm text-muted-foreground capitalize mt-1 font-mono truncate">
                  {formattedDate}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="font-display text-2xl sm:text-4xl font-bold tabular-nums text-glow-primary leading-none">
                {formattedTime}
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
                LOCAL
              </span>
            </div>
          </div>
        </div>

        {/* ===== SALUD ===== */}
        <Section icon={<Activity className="h-3.5 w-3.5" />} label="Salud · Whoop">
          {whoopLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          ) : whoopData ? (
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 py-1.5 px-3 font-mono text-xs rounded-full",
                  getRecoveryBg(whoopData.recovery_score),
                  getRecoveryColor(whoopData.recovery_score)
                )}
              >
                <Heart className="h-3 w-3" />
                RECOVERY {whoopData.recovery_score ?? "–"}%
              </Badge>
              {whoopData.hrv !== null && (
                <Badge variant="outline" className="gap-1.5 py-1.5 px-3 font-mono text-xs rounded-full bg-primary/10 border-primary/30 text-primary">
                  <Activity className="h-3 w-3" /> HRV {whoopData.hrv}ms
                </Badge>
              )}
              {whoopData.sleep_hours !== null && (
                <Badge variant="outline" className="gap-1.5 py-1.5 px-3 font-mono text-xs rounded-full bg-accent/10 border-accent/30 text-accent">
                  <BedDouble className="h-3 w-3" /> {whoopData.sleep_hours.toFixed(1)}H
                </Badge>
              )}
              {whoopData.strain !== null && (
                <Badge variant="outline" className="gap-1.5 py-1.5 px-3 font-mono text-xs rounded-full bg-muted/40 border-border text-muted-foreground">
                  <Flame className="h-3 w-3" /> STRAIN {whoopData.strain.toFixed(1)}
                </Badge>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/health")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
            >
              Sin datos Whoop · Ver sección salud →
            </button>
          )}
        </Section>

        {/* ===== TAREAS ===== */}
        <Section
          icon={<CheckSquare className="h-3.5 w-3.5" />}
          label="Tareas prioritarias"
          trailing={
            totalPending > 0 && (
              <button
                onClick={() => navigate("/tasks")}
                className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                {totalPending} pendientes <ArrowRight className="h-3 w-3" />
              </button>
            )
          }
        >
          {priorityTasks.length > 0 ? (
            <div className="space-y-1">
              {priorityTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 group py-1.5 px-2 -mx-2 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => onToggleComplete(task.id)}
                    className="h-4 w-4 border-primary/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] px-1.5 py-0.5 rounded-md",
                      task.priority === "P0"
                        ? "bg-destructive/15 border-destructive/40 text-destructive glow-destructive"
                        : "bg-warning/15 border-warning/40 text-warning"
                    )}
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-success" />
              <span className="text-xs text-success font-mono">Sin tareas urgentes</span>
            </div>
          )}
        </Section>

        {/* ===== CONTACTOS ===== */}
        <Section
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Contactos pendientes"
          trailing={
            <button
              onClick={() => navigate("/strategic-network")}
              className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Red <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          {contactsLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : pendingContacts.length > 0 ? (
            <div className="space-y-1">
              {pendingContacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 text-sm py-1.5 px-2 -mx-2 rounded-lg hover:bg-accent/5 transition-colors"
                >
                  <span className="font-semibold text-foreground">{contact.name}</span>
                  <span className="text-muted-foreground/50 text-xs">·</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{contact.action}</span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 border-accent/40 text-accent"
                  >
                    {contact.channel}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">Sin acciones pendientes</span>
          )}
        </Section>

        {/* ===== HOY ===== */}
        <Section
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="Hoy"
          last
          trailing={
            <button
              onClick={() => navigate("/calendar")}
              className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Calendario <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          {todayEvents.length > 0 ? (
            <div className="space-y-1">
              {todayEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 text-sm py-1">
                  <span className="text-xs font-mono text-primary/80 w-12 shrink-0 tabular-nums">
                    {event.allDay ? "TODO" : event.time?.substring(0, 5)}
                  </span>
                  <span className="text-foreground truncate">{event.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">Sin eventos hoy</span>
          )}
        </Section>
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-componente: cada sección con label tipo HUD                    */
/* ------------------------------------------------------------------ */

interface SectionProps {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}

const Section = ({ icon, label, trailing, last, children }: SectionProps) => (
  <div
    className={cn(
      "relative px-5 sm:px-7 py-3.5",
      !last && "border-b border-border/40"
    )}
  >
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>
      {trailing}
    </div>
    {children}
  </div>
);
