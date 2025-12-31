import { useState, useEffect } from "react";
import { CheckInCard } from "@/components/dashboard/CheckInCard";
import { AgendaCard } from "@/components/dashboard/AgendaCard";
import { PrioritiesCard } from "@/components/dashboard/PrioritiesCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DailyPlanCard } from "@/components/dashboard/DailyPlanCard";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useJarvisCore } from "@/hooks/useJarvisCore";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { checkIn, setCheckIn, loading: checkInLoading, saving } = useCheckIn();
  const { pendingTasks, toggleComplete, loading: tasksLoading } = useTasks();
  const { events: calendarEvents, connected: calendarConnected } = useGoogleCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);

  const loading = checkInLoading || tasksLoading;

  // Auto-generate plan when check-in is complete
  useEffect(() => {
    if (
      !hasGeneratedPlan && 
      !planLoading && 
      checkIn.energy > 0 && 
      checkIn.mood > 0 && 
      checkIn.focus > 0 &&
      !loading
    ) {
      handleGeneratePlan();
      setHasGeneratedPlan(true);
    }
  }, [checkIn, loading, hasGeneratedPlan, planLoading]);

  const handleGeneratePlan = async () => {
    await generatePlan(
      {
        energy: checkIn.energy,
        mood: checkIn.mood,
        focus: checkIn.focus,
        availableTime: checkIn.availableTime,
        interruptionRisk: checkIn.interruptionRisk,
        dayMode: checkIn.dayMode,
      },
      pendingTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        duration: t.duration,
      })),
      calendarEvents.map(e => ({
        title: e.title,
        time: e.time,
        duration: e.duration,
        type: e.type,
      }))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">CARGANDO DATOS...</p>
        </div>
      </div>
    );
  }

  // Get top 3 priorities (P0 first, then P1)
  const topPriorities = pendingTasks
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    })
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Quick Actions Bar */}
          <QuickActions />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Check-in & Plan */}
            <div className="lg:col-span-2 space-y-6">
              <CheckInCard 
                data={checkIn} 
                onUpdate={setCheckIn}
                saving={saving}
              />
              <DailyPlanCard 
                plan={plan}
                loading={planLoading}
                onRefresh={handleGeneratePlan}
              />
            </div>

            {/* Right Column - Calendar, Priorities & Alerts */}
            <div className="space-y-6">
              <AgendaCard />
              <PrioritiesCard 
                priorities={topPriorities}
                onToggleComplete={toggleComplete}
              />
              <AlertsCard pendingCount={pendingTasks.length} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
