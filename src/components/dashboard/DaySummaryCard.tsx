import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MessageSquare, Bell, Sun, Moon, CloudSun, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DaySummaryData {
  unreadEmails: number;
  unreadWhatsApp: number;
  eventsToday: number;
  pendingTasks: number;
}

export const DaySummaryCard = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [data, setData] = useState<DaySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 7) return "Buenas noches";
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 12) return <Sun className="h-6 w-6 text-warning" />;
    if (hour >= 12 && hour < 20) return <CloudSun className="h-6 w-6 text-warning" />;
    return <Moon className="h-6 w-6 text-primary" />;
  };

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user) return;
      try {
        const [emailsRes, whatsappRes, tasksRes] = await Promise.all([
          supabase.from("jarvis_emails_cache").select("id", { count: "exact" }).eq("user_id", user.id).eq("is_read", false),
          supabase.from("jarvis_whatsapp_cache").select("id", { count: "exact" }).eq("user_id", user.id).eq("is_read", false),
          supabase.from("tasks").select("id", { count: "exact" }).eq("user_id", user.id).eq("completed", false),
        ]);
        setData({
          unreadEmails: emailsRes.count || 0,
          unreadWhatsApp: whatsappRes.count || 0,
          eventsToday: 0,
          pendingTasks: tasksRes.count || 0,
        });
      } catch (error) {
        console.error("Error fetching day summary:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [user]);

  const userName = profile?.name || "Usuario";
  const formattedDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
  const formattedTime = format(new Date(), "HH:mm");

  if (loading) {
    return (
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPending = (data?.pendingTasks || 0) + (data?.unreadEmails || 0) + (data?.unreadWhatsApp || 0);

  return (
    <Card className="border-border/50 overflow-hidden relative">
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
      
      <CardContent className="p-4 sm:p-5 relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
              {getTimeIcon()}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">
                {getGreeting()}, <span className="text-primary">{userName}</span>
              </h2>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">
                {formattedDate}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold font-mono text-foreground/80 tabular-nums">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Stats row */}
        {data && (
          <div className="flex flex-wrap gap-2 mt-4">
            {data.pendingTasks > 0 && (
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-warning/10 border-warning/20 text-warning">
                <Bell className="h-3 w-3" />
                <span className="text-xs font-medium">{data.pendingTasks} tareas</span>
              </Badge>
            )}
            {data.unreadEmails > 0 && (
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-primary/10 border-primary/20 text-primary">
                <Mail className="h-3 w-3" />
                <span className="text-xs font-medium">{data.unreadEmails} emails</span>
              </Badge>
            )}
            {data.unreadWhatsApp > 0 && (
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-success/10 border-success/20 text-success">
                <MessageSquare className="h-3 w-3" />
                <span className="text-xs font-medium">{data.unreadWhatsApp} WhatsApp</span>
              </Badge>
            )}
            {totalPending === 0 && (
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-success/10 border-success/20 text-success">
                <Sparkles className="h-3 w-3" />
                <span className="text-xs font-medium">Todo al día</span>
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
