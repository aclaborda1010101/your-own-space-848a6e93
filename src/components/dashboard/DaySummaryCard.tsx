import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Mail, MessageSquare, Bell, Sun, Moon, Clock, Sparkles } from "lucide-react";
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
    if (hour >= 6 && hour < 20) return <Sun className="h-5 w-5 text-yellow-500" />;
    return <Moon className="h-5 w-5 text-blue-400" />;
  };

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user) return;

      try {
        const today = format(new Date(), "yyyy-MM-dd");

        // Parallel fetches for all summary data
        const [emailsRes, whatsappRes, tasksRes] = await Promise.all([
          supabase
            .from("jarvis_emails_cache")
            .select("id", { count: "exact" })
            .eq("user_id", user.id)
            .eq("is_read", false),
          supabase
            .from("jarvis_whatsapp_cache")
            .select("id", { count: "exact" })
            .eq("user_id", user.id)
            .eq("is_read", false),
          supabase
            .from("tasks")
            .select("id", { count: "exact" })
            .eq("user_id", user.id)
            .eq("completed", false),
        ]);

        setData({
          unreadEmails: emailsRes.count || 0,
          unreadWhatsApp: whatsappRes.count || 0,
          eventsToday: 0, // Would need calendar integration
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
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getTimeIcon()}
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                {getGreeting()}, {userName}
              </CardTitle>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">
                {formattedDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-mono">
              {format(new Date(), "HH:mm")}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {data?.pendingTasks && data.pendingTasks > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400">
              <Bell className="h-3.5 w-3.5" />
              {data.pendingTasks} tareas pendientes
            </Badge>
          )}
          
          {data?.unreadEmails && data.unreadEmails > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Mail className="h-3.5 w-3.5" />
              {data.unreadEmails} emails sin leer
            </Badge>
          )}
          
          {data?.unreadWhatsApp && data.unreadWhatsApp > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400">
              <MessageSquare className="h-3.5 w-3.5" />
              {data.unreadWhatsApp} WhatsApp sin leer
            </Badge>
          )}
          
          {data?.eventsToday && data.eventsToday > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400">
              <Calendar className="h-3.5 w-3.5" />
              {data.eventsToday} eventos hoy
            </Badge>
          )}
          
          {/* Show a positive message if nothing pending */}
          {data && data.pendingTasks === 0 && data.unreadEmails === 0 && data.unreadWhatsApp === 0 && (
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3 bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400">
              <Sparkles className="h-3.5 w-3.5" /> Todo al dia
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
