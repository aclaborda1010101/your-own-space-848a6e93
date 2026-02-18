import { useState, useEffect, useMemo, useCallback } from "react";
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
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";

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
import { useUserSettings } from "@/hooks/useUserSettings";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useCheckInReminder } from "@/hooks/useCheckInReminder";
import { DashboardSettingsDialog } from "@/components/dashboard/DashboardSettingsDialog";
import { ProfileSelector } from "@/components/dashboard/ProfileSelector";
import { Loader2, RotateCcw, Users, Briefcase, Heart, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import MorningBriefingCard from "@/components/dashboard/MorningBriefingCard";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Red de Contactos types ────────────────────────────────────────────────────
interface ContactSummary { id: string; name: string; brain: string | null; personality_profile: any; }
interface RecentRecording { id: string; title: string | null; received_at: string | null; agent_type: string | null; speakers: string[]; }

const Dashboard = () => {
  const navigate = useNavigate();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { settings: userSettings } = useUserSettings();
  const { checkIn, setCheckIn, registerCheckIn, loading: checkInLoading, saving, isRegistered } = useCheckIn();

  // Red de Contactos state
  const [contactsData, setContactsData] = useState<ContactSummary[]>([]);
  const [recentRecordings, setRecentRecordings] = useState<RecentRecording[]>([]);

  useEffect(() => {
    const fetchContactsData = async () => {
      try {
        const [contactsRes, threadsRes] = await Promise.all([
          supabase.from('people_contacts').select('id,name,brain,personality_profile').limit(200),
          supabase.from('plaud_threads').select('recording_ids,speakers,agent_type,event_title,event_date').order('event_date', { ascending: false }).limit(3),
        ]);
        if (contactsRes.data) setContactsData(contactsRes.data);
        if (threadsRes.data) {
          const mapped: RecentRecording[] = threadsRes.data.map((t, i) => {
            const spArray = Array.isArray(t.speakers) ? t.speakers : [];
            const names = spArray.map((s: unknown) => {
              if (typeof s === 'object' && s !== null) {
                const sp = s as Record<string, unknown>;
                return String(sp.nombre_detectado || sp.id_original || '');
              }
              return '';
            }).filter(Boolean);
            return {
              id: String(i),
              title: t.event_title,
              received_at: t.event_date,
              agent_type: t.agent_type,
              speakers: names,
            };
          });
          setRecentRecordings(mapped);
        }
      } catch { /* silent */ }
    };
    fetchContactsData();
  }, []);
  const { pendingTasks, completedTasks, toggleComplete, loading: tasksLoading } = useTasks();
  const { events: calendarEvents } = useCalendar();
  const { plan, loading: planLoading, generatePlan } = useJarvisCore();
  const { notifications, loading: notificationsLoading, fetchNotifications, dismissNotification } = useSmartNotifications();
  
  // Initialize check-in reminder
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as DashboardCardId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const draggedId = active.id as DashboardCardId;
    const overId = over.id as string;

    // Find which column contains the active item
    const activeInLeft = layout.leftColumn.includes(draggedId);
    const activeInRight = layout.rightColumn.includes(draggedId);
    const activeColumn = activeInLeft ? "left" : activeInRight ? "right" : null;

    if (!activeColumn) return;

    // Check if dropping on a column directly
    if (overId === "left-column" || overId === "right-column") {
      const targetColumn = overId === "left-column" ? "left" : "right";
      if (activeColumn !== targetColumn) {
        const targetItems = targetColumn === "left" ? layout.leftColumn : layout.rightColumn;
        moveCard(draggedId, activeColumn, targetColumn, targetItems.length);
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
      const oldIndex = items.indexOf(draggedId);
      const newIndex = items.indexOf(overId as DashboardCardId);
      if (oldIndex !== newIndex) {
        reorderInColumn(activeColumn, oldIndex, newIndex);
      }
    } else {
      // Different columns - move
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
        case "morning-briefing":
          return <MorningBriefingCard />;
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
      <SidebarNew 
        isOpen={sidebarOpen} 
        onClose={closeSidebar} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} showModeSelector />
        
        <main className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 space-y-4 sm:space-y-6">
          {/* Day Summary with Greeting */}
          {userSettings.show_day_summary !== false && <DaySummaryCard />}
          
          {/* Quick Actions Bar */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Acciones principales - ancho completo en móvil */}
            {userSettings.show_quick_actions !== false && <QuickActions />}
            
            {/* Controles de configuración - fila centrada en móvil */}
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
          {userSettings.show_notifications_panel !== false && (
            <NotificationsPanel
              notifications={notifications}
              onDismiss={dismissNotification}
              loading={notificationsLoading}
            />
          )}

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
              {/* Left Column - 4/6 = 2/3 */}
              <DashboardColumn
                id="left-column"
                items={visibleLeftCards}
                className="lg:col-span-4"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visibleLeftCards.map(renderCard)}
                </div>
              </DashboardColumn>

              {/* Right Column - 2/6 = 1/3 */}
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

            {/* Drag Overlay for smooth animations */}
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

          {/* ── Red de Contactos ──────────────────────────────────────────── */}
          {userSettings.show_contacts_card !== false && (contactsData.length > 0 || recentRecordings.length > 0) && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Red de Contactos
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => navigate('/strategic-network')}>
                    Ver todos →
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brain counts */}
                {contactsData.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'profesional', label: 'Profesional', icon: <Briefcase className="w-4 h-4 text-blue-400" />, color: 'bg-blue-500/10 border-blue-500/20' },
                      { key: 'personal', label: 'Personal', icon: <Heart className="w-4 h-4 text-pink-400" />, color: 'bg-pink-500/10 border-pink-500/20' },
                      { key: 'familiar', label: 'Familiar', icon: <Users className="w-4 h-4 text-purple-400" />, color: 'bg-purple-500/10 border-purple-500/20' },
                    ].map(({ key, label, icon, color }) => (
                      <div key={key} className={cn("rounded-xl border p-3 text-center", color)}>
                        <div className="flex justify-center mb-1">{icon}</div>
                        <p className="text-xl font-bold text-foreground">{contactsData.filter(c => c.brain === key).length}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Last 3 Plaud recordings */}
                {recentRecordings.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">ÚLTIMAS GRABACIONES</p>
                    <div className="space-y-2">
                      {recentRecordings.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/5 border border-border">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Mic className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground line-clamp-1">{rec.title || 'Sin título'}</p>
                            {rec.speakers.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                👥 {rec.speakers.join(' · ')}
                              </p>
                            )}
                          </div>
                          {rec.agent_type && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">{rec.agent_type}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI insight from first contact with personality_profile */}
                {(() => {
                  const withProfile = contactsData.find(c => c.personality_profile && Object.keys(c.personality_profile).length > 0);
                  if (!withProfile || !withProfile.personality_profile) return null;
                  const p = withProfile.personality_profile as Record<string, unknown>;
                  const insight = p.estrategia_abordaje || p.como_me_habla || p.estilo_comunicacion;
                  if (!insight) return null;
                  return (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-primary font-mono mb-1">💡 INSIGHT — {withProfile.name}</p>
                      <p className="text-xs text-foreground leading-relaxed line-clamp-2">{String(insight)}</p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
      
      {/* Bottom Navigation - Mobile only */}
      <BottomNavBar />
    </div>
  );
};

export default Dashboard;
