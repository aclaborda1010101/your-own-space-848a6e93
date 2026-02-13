import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Mail, MessageSquare, Bell, Sun, Moon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DaySummaryData {
  unreadEmails: number;
  unreadWhatsApp: number;
  eventsToday: number;
  pendingTasks: number;
  notifications: number;
}

export const DaySummaryCard = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [data, setData] = useState<DaySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 20) return <Sun className="h-5 w-5 text-warning" />;
    return <Moon className="h-5 w-5 text-primary" />;
  };

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user) return;
      try {
        const today = format(new Date(), "yyyy-MM-dd");
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
          notifications: 0,
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

  if (loading) {
    return (
      <Card className="border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-2 p-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40 mt-1" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-transparent overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {getTimeIcon()}
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl font-bold font-display truncate">
                {getGreeting()}, {userName}
              </CardTitle>
              <p className="text-xs text-muted-foreground capitalize mt-0.5 truncate">
                {formattedDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-mono">
              {format(new Date(), "HH:mm")}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5">
          {data?.pendingTasks && data.pendingTasks > 0 && (
            <Badge variant="outline" className="gap-1 py-1 px-2.5 text-xs bg-warning/10 border-warning/20 text-warning rounded-full">
              <Bell className="h-3 w-3" />
              {data.pendingTasks} tareas
            </Badge>
          )}
          
          {data?.unreadEmails && data.unreadEmails > 0 && (
            <Badge variant="outline" className="gap-1 py-1 px-2.5 text-xs bg-primary/10 border-primary/20 text-primary rounded-full">
              <Mail className="h-3 w-3" />
              {data.unreadEmails} emails
            </Badge>
          )}
          
          {data?.unreadWhatsApp && data.unreadWhatsApp > 0 && (
            <Badge variant="outline" className="gap-1 py-1 px-2.5 text-xs bg-success/10 border-success/20 text-success rounded-full">
              <MessageSquare className="h-3 w-3" />
              {data.unreadWhatsApp} WhatsApp
            </Badge>
          )}
          
          {data?.eventsToday && data.eventsToday > 0 && (
            <Badge variant="outline" className="gap-1 py-1 px-2.5 text-xs bg-accent/10 border-accent/20 text-accent rounded-full">
              <Calendar className="h-3 w-3" />
              {data.eventsToday} eventos
            </Badge>
          )}
          
          {data && data.pendingTasks === 0 && data.unreadEmails === 0 && data.unreadWhatsApp === 0 && (
            <Badge variant="outline" className="gap-1 py-1 px-2.5 text-xs bg-success/10 border-success/20 text-success rounded-full">
              ✨ Todo al día
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
