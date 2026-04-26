import { useState, useMemo, useEffect } from "react";
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
import { SuggestionsCard } from "@/components/dashboard/SuggestionsCard";

import { CommandCenterCard } from "@/components/dashboard/CommandCenterCard";
import { ExecutiveSummaryCard } from "@/components/dashboard/ExecutiveSummaryCard";


import { DraggableCard } from "@/components/dashboard/DraggableCard";
import { DashboardColumn } from "@/components/dashboard/DashboardColumn";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { useJarvisCore } from "@/hooks/useJarvisCore";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { useJarvisChallenge } from "@/hooks/useJarvisChallenge";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useJarvisWhoopData } from "@/hooks/useJarvisWhoopData";
import { useWhoopHistory } from "@/hooks/useWhoopHistory";
import { useDashboardLayout, DashboardCardId, CardWidth } from "@/hooks/useDashboardLayout";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useCheckInReminder } from "@/hooks/useCheckInReminder";
import { DashboardSettingsDialog } from "@/components/dashboard/DashboardSettingsDialog";
import { ProfileSelector } from "@/components/dashboard/ProfileSelector";
import { Loader2, RotateCcw, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import MorningBriefingCard from "@/components/dashboard/MorningBriefingCard";
import TomorrowBriefCard from "@/components/dashboard/TomorrowBriefCard";
import { BurnoutBanner } from "@/components/dashboard/BurnoutBanner";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const { settings: userSettings } = useUserSettings();
  const { checkIn, setCheckIn, registerCheckIn, loading: checkInLoading, saving, isRegistered, prefilledFromWhoop } = useCheckIn();

  const { 
    tasks, 
    loading: tasksLoading, 
    toggleComplete, 
  } = useTasks();
  const { events, loading: calendarLoading, connected: calendarConnected, fetchEvents } = useCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const { notifications } = useSmartNotifications();
  const { challenges, loading: challengesLoading, toggleGoalCompletion, createChallenge, updateChallenge } = useJarvisChallenge();
  const { profile } = useUserProfile();
  const { data: whoopData, isLoading: whoopLoading } = useJarvisWhoopData();
  const { history: whoopHistory } = useWhoopHistory(7);

  const {
    layout, profiles, activeProfileId, isLoaded,
    visibleLeftCards, visibleRightCards,
    moveCard, reorderInColumn, setCardVisibility, setCardSize, setCardWidth, 
    resetLayout, switchProfile, createProfile, duplicateProfile, renameProfile, setProfileIcon, deleteProfile
  } = useDashboardLayout();

  useCheckInReminder(isRegistered);

  const activeChallenges = challenges.filter(c => c.status === "active");

  const topPriorities = useMemo(() => {
    return tasks
      .filter(t => !t.completed && (t.type === "work" || t.type === "life"))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
  }, [tasks]);

  const handleGeneratePlan = async () => {
    if (!profile) return;
    await generatePlan(
      checkIn,
      tasks,
      events.slice(0, 5)
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeId, setActiveId] = useState<DashboardCardId | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as DashboardCardId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      // Find which column the cards are in
      const allCards = [...layout.leftColumn, ...layout.rightColumn];
      const activeInLeft = layout.leftColumn.includes(active.id as DashboardCardId);
      const overInLeft = layout.leftColumn.includes(over.id as DashboardCardId);
      const column = activeInLeft ? layout.leftColumn : layout.rightColumn;
      const columnKey = activeInLeft ? "left" : "right";

      if (activeInLeft === overInLeft) {
        const oldIndex = column.indexOf(active.id as DashboardCardId);
        const newIndex = column.indexOf(over.id as DashboardCardId);
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderInColumn(columnKey as "left" | "right", oldIndex, newIndex);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const getCardLabel = (id: DashboardCardId): string => {
    const labels: Record<DashboardCardId, string> = {
      "morning-briefing": "Briefing Matutino",
      "check-in": "Check-in",
      "daily-plan": "Plan del día",
      "publications": "Publicaciones",
      "agenda": "Agenda",
      "challenge": "Retos",
      "coach": "Coach",
      "priorities": "Prioridades",
      "alerts": "Alertas",
      "habits-insights": "Insights de Hábitos",
      "suggestions": "Sugerencias Plaud",
    };
    return labels[id] || id;
  };

  const pendingTaskCount = tasks.filter(t => !t.completed).length;

  const renderCard = (id: DashboardCardId) => {
    const settings = layout.cardSettings[id];
    const cardSize = settings?.size || "normal";
    const cardWidth = settings?.width || "full";
    const handleSizeChange = (size: typeof cardSize) => setCardSize(id, size);
    const handleWidthChange = (w: CardWidth) => setCardWidth(id, w);
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
        case "morning-briefing":
          return <MorningBriefingCard />;
        case "check-in":
          return <CheckInCard data={checkIn} onUpdate={setCheckIn} onRegister={registerCheckIn} saving={saving} isRegistered={isRegistered} prefilledFromWhoop={prefilledFromWhoop} />;
        case "daily-plan":
          return <DailyPlanCard plan={plan} loading={planLoading} onRefresh={handleGeneratePlan} />;
        case "publications":
          return <PublicationsCard />;
        case "agenda":
          return <AgendaCard events={events} loading={calendarLoading} connected={calendarConnected} fetchEvents={fetchEvents} />;
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
          return <AlertsCard pendingCount={pendingTaskCount} />;
        case "habits-insights":
          return <HabitsInsightsCard />;
        case "suggestions":
          return <SuggestionsCard />;
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

  if (!isLoaded) {
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
    <div className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 space-y-5 sm:space-y-6">
      {/* Day Summary with Greeting */}
      {userSettings.show_day_summary !== false && (
        <CommandCenterCard tasks={tasks} events={events} onToggleComplete={toggleComplete} whoopData={whoopData} whoopLoading={whoopLoading} profile={profile} />
      )}

      {/* Banner proactivo de burnout / patrón crónico de recuperación baja */}
      <BurnoutBanner tasks={tasks} whoopData={whoopData} whoopHistory={whoopHistory} />

      {/* Brief de mañana (solo después de las 20h) */}
      <TomorrowBriefCard />

      {/* JARVIS Executive Summary — daily LLM brief, cached, manual refresh */}
      <ExecutiveSummaryCard />
      
      {/* Quick Actions Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {userSettings.show_quick_actions !== false && <QuickActions />}
        
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
        </div>
      </div>

      {/* Draggable Cards Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardColumn id="left" items={visibleLeftCards}>
            {visibleLeftCards.map(id => renderCard(id))}
          </DashboardColumn>
          <DashboardColumn id="right" items={visibleRightCards}>
            {visibleRightCards.map(id => renderCard(id))}
          </DashboardColumn>
        </div>
        
        <DragOverlay>
          {activeId ? (
            <div className="opacity-80 rotate-2 scale-105">
              {renderCard(activeId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

    </div>
  );
};

export default Dashboard;
