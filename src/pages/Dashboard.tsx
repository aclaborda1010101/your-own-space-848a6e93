import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
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
import { HabitsInsightsCard } from "@/components/dashboard/HabitsInsightsCard";

import { DaySummaryCard } from "@/components/dashboard/DaySummaryCard";

import { DraggableCard } from "@/components/dashboard/DraggableCard";
import { DashboardColumn } from "@/components/dashboard/DashboardColumn";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { useJarvisCore } from "@/hooks/useJarvisCore";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { useJarvisChallenge } from "@/hooks/useJarvisChallenge";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDashboardLayout, DashboardCardId, CardWidth } from "@/hooks/useDashboardLayout";
import { useCheckInReminder } from "@/hooks/useCheckInReminder";
import { DashboardSettingsDialog } from "@/components/dashboard/DashboardSettingsDialog";
import { ProfileSelector } from "@/components/dashboard/ProfileSelector";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import MorningBriefingCard from "@/components/dashboard/MorningBriefingCard";
import EveningBriefingCard from "@/components/dashboard/EveningBriefingCard";
import WeeklySummaryCard from "@/components/dashboard/WeeklySummaryCard";

const Dashboard = () => {
  const { checkIn, setCheckIn, registerCheckIn, loading: checkInLoading, saving, isRegistered } = useCheckIn();
  const { pendingTasks, completedTasks, toggleComplete, loading: tasksLoading } = useTasks();
  const { events: calendarEvents } = useCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const { notifications, loading: notificationsLoading, fetchNotifications, dismissNotification } = useSmartNotifications();
  
  useCheckInReminder();
  const { 
    activeChallenges, 
    loading: challengesLoading, 
    createChallenge,
    updateChallenge, 
    toggleGoalCompletion 
  } = useJarvisChallenge();
  const { 
    layout, 
    profiles,
    activeProfileId,
    visibleLeftCards, 
    visibleRightCards, 
    isLoaded, 
    reorderInColumn, 
    moveCard, 
    setCardSize, 
    setCardWidth,
    setCardVisibility,
    resetLayout,
    createProfile,
    duplicateProfile,
    renameProfile,
    setProfileIcon,
    deleteProfile,
    switchProfile,
  } = useDashboardLayout();
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);
  const [hasGeneratedNotifications, setHasGeneratedNotifications] = useState(false);
  const [activeId, setActiveId] = useState<DashboardCardId | null>(null);

  const loading = checkInLoading || tasksLoading;

  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const topPriorities = useMemo(() => 
    pendingTasks
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      })
      .slice(0, 3),
    [pendingTasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as DashboardCardId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const draggedId = active.id as DashboardCardId;
    const overId = over.id as string;

    const activeInLeft = layout.leftColumn.includes(draggedId);
    const activeInRight = layout.rightColumn.includes(draggedId);
    const activeColumn = activeInLeft ? "left" : activeInRight ? "right" : null;

    if (!activeColumn) return;

    if (overId === "left-column" || overId === "right-column") {
      const targetColumn = overId === "left-column" ? "left" : "right";
      if (activeColumn !== targetColumn) {
        const targetItems = targetColumn === "left" ? layout.leftColumn : layout.rightColumn;
        moveCard(draggedId, activeColumn, targetColumn, targetItems.length);
      }
      return;
    }

    const overInLeft = layout.leftColumn.includes(overId as DashboardCardId);
    const overInRight = layout.rightColumn.includes(overId as DashboardCardId);
    const overColumn = overInLeft ? "left" : overInRight ? "right" : null;

    if (!overColumn) return;

    if (activeColumn === overColumn) {
      const items = activeColumn === "left" ? layout.leftColumn : layout.rightColumn;
      const oldIndex = items.indexOf(draggedId);
      const newIndex = items.indexOf(overId as DashboardCardId);
      if (oldIndex !== newIndex) {
        reorderInColumn(activeColumn, oldIndex, newIndex);
      }
    } else {
      const targetItems = overColumn === "left" ? layout.leftColumn : layout.rightColumn;
      const newIndex = targetItems.indexOf(overId as DashboardCardId);
      moveCard(draggedId, activeColumn, overColumn, newIndex);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const getCardLabel = (id: DashboardCardId): string => {
    const labels: Record<DashboardCardId, string> = {
      "check-in": "Check-in",
      "daily-plan": "Plan del día",
      "publications": "Publicaciones",
      "agenda": "Agenda",
      "challenge": "Retos",
      "coach": "Coach",
      "priorities": "Prioridades",
      "alerts": "Alertas",
      "habits-insights": "Insights de Hábitos",
    };
    return labels[id] || id;
  };

  const renderCard = (id: DashboardCardId) => {
    const settings = layout.cardSettings[id];
    const cardSize = settings?.size || "normal";
    const cardWidth = settings?.width || "full";
    const handleSizeChange = (size: typeof cardSize) => setCardSize(id, size);
    const handleWidthChange = (width: CardWidth) => setCardWidth(id, width);
    const handleHide = () => setCardVisibility(id, false);

    const widthClasses: Record<CardWidth, string> = {
      "1/3": "lg:col-span-1",
      "1/2": "lg:col-span-1",
      "2/3": "lg:col-span-2",
      "full": "col-span-full",
    };

    const wrapperClass = widthClasses[cardWidth];

    const cardContent = (() => {
      switch (id) {
        case "check-in":
          return <CheckInCard data={checkIn} onUpdate={setCheckIn} onRegister={registerCheckIn} saving={saving} isRegistered={isRegistered} />;
        case "daily-plan":
          return <DailyPlanCard plan={plan} loading={planLoading} onRefresh={handleGeneratePlan} />;
        case "publications":
          return <PublicationsCard />;
        case "agenda":
          return <AgendaCard />;
        case "challenge":
          return (
            <ChallengeCard 
              challenges={activeChallenges}
              loading={challengesLoading}
              onCreateChallenge={createChallenge}
              onToggleGoal={toggleGoalCompletion}
              onUpdateChallenge={updateChallenge}
            />
          );
        case "coach":
          return <CoachCard checkInData={checkIn} />;
        case "priorities":
          return <PrioritiesCard priorities={topPriorities} onToggleComplete={toggleComplete} />;
        case "alerts":
          return <AlertsCard pendingCount={pendingTasks.length} />;
        case "habits-insights":
          return <HabitsInsightsCard />;
        default:
          return null;
      }
    })();

    return (
      <DraggableCard 
        key={id} 
        id={id} 
        size={cardSize} 
        width={cardWidth}
        onSizeChange={handleSizeChange}
        onWidthChange={handleWidthChange}
        onHide={handleHide}
        className={wrapperClass}
      >
        {cardContent}
      </DraggableCard>
    );
  };

  if (loading || !isLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">CARGANDO DATOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 space-y-4 sm:space-y-6">
      {/* Day Summary with Greeting */}
      <DaySummaryCard />

      {/* Briefings Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MorningBriefingCard />
        <EveningBriefingCard />
        <WeeklySummaryCard />
      </div>
      
      {/* Quick Actions Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <QuickActions />
        
        <div className="flex items-center justify-center md:justify-end gap-2 flex-shrink-0">
          <ProfileSelector
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSwitch={switchProfile}
          />
          <DashboardSettingsDialog
            cardSettings={layout.cardSettings}
            profiles={profiles}
            activeProfileId={activeProfileId}
            onVisibilityChange={setCardVisibility}
            onWidthChange={setCardWidth}
            onReset={resetLayout}
            onCreateProfile={createProfile}
            onDuplicateProfile={duplicateProfile}
            onRenameProfile={renameProfile}
            onSetProfileIcon={setProfileIcon}
            onDeleteProfile={deleteProfile}
            onSwitchProfile={switchProfile}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={resetLayout}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restablecer tarjetas</TooltipContent>
          </Tooltip>
        </div>
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
        measuring={measuringConfig}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          <DashboardColumn
            id="left-column"
            items={visibleLeftCards}
            className="lg:col-span-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {visibleLeftCards.map(renderCard)}
            </div>
          </DashboardColumn>

          <DashboardColumn
            id="right-column"
            items={visibleRightCards}
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-1 gap-6">
              {visibleRightCards.map(renderCard)}
            </div>
          </DashboardColumn>
        </div>

        <DragOverlay dropAnimation={{
          duration: 300,
          easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        }}>
          {activeId ? (
            <div className="opacity-90 scale-[1.02] shadow-2xl shadow-primary/30 rounded-lg ring-2 ring-primary/50">
              <div className="bg-card rounded-lg p-4 border border-primary/30">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {getCardLabel(activeId)}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default Dashboard;
