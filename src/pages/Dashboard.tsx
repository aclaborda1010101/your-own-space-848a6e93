import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { CheckInCard } from "@/components/dashboard/CheckInCard";
import { AgendaCard } from "@/components/dashboard/AgendaCard";
import { PrioritiesCard } from "@/components/dashboard/PrioritiesCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DailyPlanCard } from "@/components/dashboard/DailyPlanCard";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { CoachCard } from "@/components/coach/CoachCard";
import { ChallengeCard } from "@/components/challenge/ChallengeCard";
import { PublicationsCard } from "@/components/publications/PublicationsCard";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { JarvisVoiceButton } from "@/components/voice/JarvisVoiceButton";
import { PomodoroFloatingButton } from "@/components/pomodoro/PomodoroFloatingButton";
import { DraggableCard } from "@/components/dashboard/DraggableCard";
import { DashboardColumn } from "@/components/dashboard/DashboardColumn";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useJarvisCore } from "@/hooks/useJarvisCore";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { useJarvisChallenge } from "@/hooks/useJarvisChallenge";
import { useDashboardLayout, DashboardCardId } from "@/hooks/useDashboardLayout";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { checkIn, setCheckIn, loading: checkInLoading, saving } = useCheckIn();
  const { pendingTasks, completedTasks, toggleComplete, loading: tasksLoading } = useTasks();
  const { events: calendarEvents } = useGoogleCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const { notifications, loading: notificationsLoading, fetchNotifications, dismissNotification } = useSmartNotifications();
  const { 
    activeChallenges, 
    loading: challengesLoading, 
    createChallenge,
    updateChallenge, 
    toggleGoalCompletion 
  } = useJarvisChallenge();
  const { layout, isLoaded, reorderInColumn, moveCard, resetLayout } = useDashboardLayout();
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);
  const [hasGeneratedNotifications, setHasGeneratedNotifications] = useState(false);

  const loading = checkInLoading || tasksLoading;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  // Auto-generate notifications after data loads
  useEffect(() => {
    if (!hasGeneratedNotifications && !loading && !notificationsLoading) {
      handleFetchNotifications();
      setHasGeneratedNotifications(true);
    }
  }, [loading, hasGeneratedNotifications, notificationsLoading]);

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

  const handleFetchNotifications = async () => {
    const allTasks = [...pendingTasks, ...completedTasks];
    await fetchNotifications(
      checkIn.energy > 0 ? {
        energy: checkIn.energy,
        mood: checkIn.mood,
        focus: checkIn.focus,
        availableTime: checkIn.availableTime,
        interruptionRisk: checkIn.interruptionRisk,
        dayMode: checkIn.dayMode,
      } : null,
      allTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        duration: t.duration,
        completed: t.completed,
      })),
      calendarEvents.map(e => ({
        title: e.title,
        time: e.time,
        duration: e.duration,
      }))
    );
  };

  // Get top 3 priorities (P0 first, then P1)
  const topPriorities = useMemo(() => 
    pendingTasks
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      })
      .slice(0, 3),
    [pendingTasks]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as DashboardCardId;
    const overId = over.id as string;

    // Find which column contains the active item
    const activeInLeft = layout.leftColumn.includes(activeId);
    const activeInRight = layout.rightColumn.includes(activeId);
    const activeColumn = activeInLeft ? "left" : activeInRight ? "right" : null;

    if (!activeColumn) return;

    // Check if dropping on a column directly
    if (overId === "left-column" || overId === "right-column") {
      const targetColumn = overId === "left-column" ? "left" : "right";
      if (activeColumn !== targetColumn) {
        const targetItems = targetColumn === "left" ? layout.leftColumn : layout.rightColumn;
        moveCard(activeId, activeColumn, targetColumn, targetItems.length);
      }
      return;
    }

    // Dropping on another card
    const overInLeft = layout.leftColumn.includes(overId as DashboardCardId);
    const overInRight = layout.rightColumn.includes(overId as DashboardCardId);
    const overColumn = overInLeft ? "left" : overInRight ? "right" : null;

    if (!overColumn) return;

    if (activeColumn === overColumn) {
      // Same column - reorder
      const items = activeColumn === "left" ? layout.leftColumn : layout.rightColumn;
      const oldIndex = items.indexOf(activeId);
      const newIndex = items.indexOf(overId as DashboardCardId);
      if (oldIndex !== newIndex) {
        reorderInColumn(activeColumn, oldIndex, newIndex);
      }
    } else {
      // Different columns - move
      const targetItems = overColumn === "left" ? layout.leftColumn : layout.rightColumn;
      const newIndex = targetItems.indexOf(overId as DashboardCardId);
      moveCard(activeId, activeColumn, overColumn, newIndex);
    }
  };

  const renderCard = (id: DashboardCardId) => {
    switch (id) {
      case "check-in":
        return (
          <DraggableCard key={id} id={id}>
            <CheckInCard data={checkIn} onUpdate={setCheckIn} saving={saving} />
          </DraggableCard>
        );
      case "daily-plan":
        return (
          <DraggableCard key={id} id={id}>
            <DailyPlanCard plan={plan} loading={planLoading} onRefresh={handleGeneratePlan} />
          </DraggableCard>
        );
      case "publications":
        return (
          <DraggableCard key={id} id={id}>
            <PublicationsCard />
          </DraggableCard>
        );
      case "agenda":
        return (
          <DraggableCard key={id} id={id}>
            <AgendaCard />
          </DraggableCard>
        );
      case "challenge":
        return (
          <DraggableCard key={id} id={id}>
            <ChallengeCard 
              challenges={activeChallenges}
              loading={challengesLoading}
              onCreateChallenge={createChallenge}
              onToggleGoal={toggleGoalCompletion}
              onUpdateChallenge={updateChallenge}
            />
          </DraggableCard>
        );
      case "coach":
        return (
          <DraggableCard key={id} id={id}>
            <CoachCard checkInData={checkIn} />
          </DraggableCard>
        );
      case "priorities":
        return (
          <DraggableCard key={id} id={id}>
            <PrioritiesCard priorities={topPriorities} onToggleComplete={toggleComplete} />
          </DraggableCard>
        );
      case "alerts":
        return (
          <DraggableCard key={id} id={id}>
            <AlertsCard pendingCount={pendingTasks.length} />
          </DraggableCard>
        );
      default:
        return null;
    }
  };

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">CARGANDO DATOS...</p>
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
          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between">
            <QuickActions />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={resetLayout}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restablecer orden de tarjetas</TooltipContent>
            </Tooltip>
          </div>

          {/* Smart Notifications */}
          <NotificationsPanel
            notifications={notifications}
            onDismiss={dismissNotification}
            loading={notificationsLoading}
          />

          {/* Main Grid with Drag & Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <DashboardColumn
                id="left-column"
                items={layout.leftColumn}
                className="lg:col-span-2"
              >
                {layout.leftColumn.map(renderCard)}
              </DashboardColumn>

              {/* Right Column */}
              <DashboardColumn
                id="right-column"
                items={layout.rightColumn}
              >
                {layout.rightColumn.map(renderCard)}
              </DashboardColumn>
            </div>
          </DndContext>
        </main>
      </div>
      
      {/* Floating Buttons */}
      <PomodoroFloatingButton />
      <JarvisVoiceButton />
    </div>
  );
};

export default Dashboard;
