import { useState, useMemo } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useJarvisChallenge, ChallengeWithProgress } from "@/hooks/useJarvisChallenge";

import { CreateChallengeDialog } from "@/components/challenge/CreateChallengeDialog";
import { EditChallengeDialog } from "@/components/challenge/EditChallengeDialog";
import {
  Target, 
  Trophy, 
  Flame, 
  Calendar, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  MoreVertical,
  Trash2,
  Play,
  Pause,
  Award,
  Zap,
  BarChart3,
  Pencil
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Challenges = () => {
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithProgress | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  const { 
    challenges, 
    activeChallenges, 
    completedChallenges, 
    loading,
    toggleGoalCompletion,
    updateChallengeStatus,
    updateChallenge,
    deleteChallenge,
    createChallenge,
  } = useJarvisChallenge();

  const abandonedChallenges = challenges.filter(c => c.status === "abandoned");

  const stats = useMemo(() => {
    const totalDaysTracked = challenges.reduce((acc, c) => {
      return acc + c.logs.filter(l => l.completed).length;
    }, 0);
    
    const totalGoalsCompleted = challenges.reduce((acc, c) => {
      return acc + c.logs.filter(l => l.completed).length;
    }, 0);

    const bestStreak = Math.max(0, ...challenges.map(c => c.progress.longestStreak));
    
    const successRate = completedChallenges.length > 0 
      ? Math.round((completedChallenges.length / (completedChallenges.length + abandonedChallenges.length)) * 100)
      : activeChallenges.length > 0 ? 100 : 0;

    return {
      totalChallenges: challenges.length,
      activeChallenges: activeChallenges.length,
      completedChallenges: completedChallenges.length,
      abandonedChallenges: abandonedChallenges.length,
      totalDaysTracked,
      totalGoalsCompleted,
      bestStreak,
      successRate,
    };
  }, [challenges, activeChallenges, completedChallenges, abandonedChallenges]);

  const handleDelete = async () => {
    if (selectedChallenge) {
      await deleteChallenge(selectedChallenge.id);
      setDeleteDialogOpen(false);
      setSelectedChallenge(null);
    }
  };

  const getGoalTypeColor = (goalType: string | null) => {
    switch (goalType) {
      case 'objetivo': return 'bg-success/20 text-success border-success/30';
      case 'proposito': return 'bg-primary/20 text-primary border-primary/30';
      case 'prohibicion': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'excepcion': return 'bg-warning/20 text-warning border-warning/30';
      default: return 'bg-muted/50 text-muted-foreground border-border';
    }
  };

  const getGoalTypeLabel = (goalType: string | null) => {
    switch (goalType) {
      case 'objetivo': return 'Objetivo';
      case 'proposito': return 'Propósito';
      case 'prohibicion': return 'Prohibición';
      case 'excepcion': return 'Excepción';
      default: return goalType || 'Objetivo';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">Activo</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-success/20 text-success border-success/30">Completado</Badge>;
      case 'abandoned':
        return <Badge variant="secondary" className="bg-destructive/20 text-destructive border-destructive/30">Abandonado</Badge>;
      default:
        return null;
    }
  };

  const renderChallengeCard = (challenge: ChallengeWithProgress) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = challenge.logs.filter(l => l.date === todayStr);
    
    return (
      <Card key={challenge.id} className="bg-card/50 border-border/50 hover:bg-muted/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-foreground truncate">{challenge.name}</h3>
                {getStatusBadge(challenge.status)}
              </div>
              
              {challenge.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {challenge.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{challenge.duration_days} días</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-warning" />
                  <span>Racha: {challenge.progress.currentStreak}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-primary" />
                  <span>Mejor: {challenge.progress.longestStreak}</span>
                </div>
              </div>

              {challenge.status === "active" && (
                <>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium">{challenge.progress.percentComplete}%</span>
                    </div>
                    <Progress value={challenge.progress.percentComplete} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Día {challenge.progress.daysElapsed + 1}</span>
                      <span>{challenge.progress.daysRemaining} días restantes</span>
                    </div>
                  </div>

                  {/* Today's daily goals */}
                  {challenge.goals.filter(g => g.frequency === "daily").length > 0 && (
                    <div className="space-y-2 mb-3">
                      <p className="text-xs text-muted-foreground">Objetivos diarios:</p>
                      {challenge.goals
                        .filter(g => g.frequency === "daily")
                        .map(goal => {
                          const isCompleted = todayLogs.some(
                            l => l.goal_id === goal.id && l.completed
                          );
                          return (
                            <div key={goal.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={isCompleted}
                                onCheckedChange={(checked) => 
                                  toggleGoalCompletion(challenge.id, goal.id, !!checked)
                                }
                              />
                              <span className={cn(
                                "text-sm",
                                isCompleted && "line-through text-muted-foreground"
                              )}>
                                {goal.title}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Global goals */}
                  {challenge.goals.filter(g => g.frequency === "global").length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Objetivos globales:</p>
                      {challenge.goals
                        .filter(g => g.frequency === "global")
                        .map(goal => {
                          const completedCount = challenge.logs.filter(
                            l => l.goal_id === goal.id && l.completed
                          ).length;
                          const isFullyCompleted = completedCount >= goal.target_count;
                          return (
                            <div key={goal.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={todayLogs.some(l => l.goal_id === goal.id && l.completed)}
                                  onCheckedChange={(checked) => 
                                    toggleGoalCompletion(challenge.id, goal.id, !!checked)
                                  }
                                  disabled={isFullyCompleted}
                                />
                                <span className={cn(
                                  "text-sm",
                                  isFullyCompleted && "line-through text-muted-foreground"
                                )}>
                                  {goal.title}
                                </span>
                              </div>
                              <Badge variant="outline" className={cn(
                                "text-xs",
                                isFullyCompleted ? "bg-success/20 text-success" : ""
                              )}>
                                {completedCount}/{goal.target_count}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setSelectedChallenge(challenge);
                  setEditDialogOpen(true);
                }}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar reto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSelectedChallenge(challenge);
                  setDetailDialogOpen(true);
                }}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Ver detalles
                </DropdownMenuItem>
                {challenge.status === "active" && (
                  <>
                    <DropdownMenuItem onClick={() => updateChallengeStatus(challenge.id, "completed")}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Marcar completado
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateChallengeStatus(challenge.id, "abandoned")}>
                      <Pause className="w-4 h-4 mr-2" />
                      Abandonar
                    </DropdownMenuItem>
                  </>
                )}
                {challenge.status !== "active" && (
                  <DropdownMenuItem onClick={() => updateChallengeStatus(challenge.id, "active")}>
                    <Play className="w-4 h-4 mr-2" />
                    Reactivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => {
                    setSelectedChallenge(challenge);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <main className="p-4 md:p-6 space-y-6">
          <Breadcrumbs />
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                JARVIS Retos
              </h1>
              <p className="text-muted-foreground">
                Gestiona tus desafíos personales
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Reto
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.activeChallenges}</p>
                  <p className="text-xs text-muted-foreground">Retos activos</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completedChallenges}</p>
                  <p className="text-xs text-muted-foreground">Completados</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.bestStreak}</p>
                  <p className="text-xs text-muted-foreground">Mejor racha</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.successRate}%</p>
                  <p className="text-xs text-muted-foreground">Tasa de éxito</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-muted/30 border-border/30">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{stats.totalChallenges}</p>
                <p className="text-xs text-muted-foreground">Total retos</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-border/30">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{stats.totalGoalsCompleted}</p>
                <p className="text-xs text-muted-foreground">Objetivos cumplidos</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-border/30">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{stats.totalDaysTracked}</p>
                <p className="text-xs text-muted-foreground">Días registrados</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-border/30">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground">{stats.abandonedChallenges}</p>
                <p className="text-xs text-muted-foreground">Abandonados</p>
              </CardContent>
            </Card>
          </div>

          {/* Challenges Tabs */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="active" className="gap-2">
                <Zap className="w-4 h-4" />
                Activos ({activeChallenges.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <Trophy className="w-4 h-4" />
                Completados ({completedChallenges.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="w-4 h-4" />
                Historial ({challenges.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Cargando...
                </div>
              ) : activeChallenges.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="p-12 text-center">
                    <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">No hay retos activos</h3>
                    <p className="text-muted-foreground mb-4">Crea tu primer reto para empezar</p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Reto
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {activeChallenges.map(renderChallengeCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {completedChallenges.length === 0 ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="p-12 text-center">
                    <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">Sin retos completados</h3>
                    <p className="text-muted-foreground">¡Completa tu primer reto!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {completedChallenges.map(renderChallengeCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Historial Completo</CardTitle>
                  <CardDescription>Todos tus retos ordenados por fecha</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {challenges.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay historial aún</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {challenges.map(challenge => (
                          <div
                            key={challenge.id}
                            className="p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedChallenge(challenge);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{challenge.name}</h4>
                                {getStatusBadge(challenge.status)}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(challenge.start_date), "d MMM yyyy", { locale: es })}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{challenge.duration_days} días</span>
                              <span>•</span>
                              <span>{challenge.goals.length} objetivos</span>
                              <span>•</span>
                              <span>Racha máx: {challenge.progress.longestStreak}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

      {/* Create Dialog */}
      <CreateChallengeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateChallenge={createChallenge}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos del reto "{selectedChallenge?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Challenge Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {selectedChallenge?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedChallenge && (
            <div className="space-y-6">
              {/* Status and dates */}
              <div className="flex flex-wrap items-center gap-3">
                {getStatusBadge(selectedChallenge.status)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(selectedChallenge.start_date), "d MMM", { locale: es })} - {format(new Date(selectedChallenge.end_date), "d MMM yyyy", { locale: es })}
                </span>
              </div>

              {selectedChallenge.description && (
                <p className="text-muted-foreground">{selectedChallenge.description}</p>
              )}

              {/* Progress */}
              <div>
                <h4 className="text-sm font-medium mb-3">Progreso</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-2xl font-bold text-primary">{selectedChallenge.progress.percentComplete}%</p>
                    <p className="text-xs text-muted-foreground">Completado</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-2xl font-bold text-warning">{selectedChallenge.progress.currentStreak}</p>
                    <p className="text-xs text-muted-foreground">Racha actual</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-2xl font-bold text-success">{selectedChallenge.progress.longestStreak}</p>
                    <p className="text-xs text-muted-foreground">Mejor racha</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-2xl font-bold">{selectedChallenge.progress.daysElapsed}</p>
                    <p className="text-xs text-muted-foreground">Días transcurridos</p>
                  </div>
                </div>
              </div>

              {/* Goals by Type */}
              {selectedChallenge.goals.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Elementos del reto ({selectedChallenge.goals.length})</h4>
                  <div className="space-y-3">
                    {(['objetivo', 'proposito', 'prohibicion', 'excepcion'] as const).map(goalType => {
                      const goalsOfType = selectedChallenge.goals.filter(g => (g.goal_type || 'objetivo') === goalType);
                      if (goalsOfType.length === 0) return null;
                      
                      return (
                        <div key={goalType} className="space-y-2">
                          <Badge variant="outline" className={cn("text-xs", getGoalTypeColor(goalType))}>
                            {getGoalTypeLabel(goalType)} ({goalsOfType.length})
                          </Badge>
                          {goalsOfType.map(goal => {
                            const completedCount = selectedChallenge.logs.filter(
                              l => l.goal_id === goal.id && l.completed
                            ).length;
                            return (
                              <div key={goal.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 ml-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{goal.title}</span>
                                  {goal.frequency === 'daily' && (
                                    <Badge variant="outline" className="text-xs">Diario</Badge>
                                  )}
                                  {goal.frequency === 'global' && (
                                    <Badge variant="outline" className="text-xs">
                                      {completedCount}/{goal.target_count}
                                    </Badge>
                                  )}
                                </div>
                                {goal.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                                )}
                                {goal.frequency === 'daily' && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Completado {completedCount} días
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Motivation and Reward */}
              {(selectedChallenge.motivation || selectedChallenge.reward) && (
                <div className="grid md:grid-cols-2 gap-4">
                  {selectedChallenge.motivation && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary mb-1 font-medium">Motivación</p>
                      <p className="text-sm">{selectedChallenge.motivation}</p>
                    </div>
                  )}
                  {selectedChallenge.reward && (
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-xs text-success mb-1 font-medium">Recompensa</p>
                      <p className="text-sm">{selectedChallenge.reward}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedChallenge && (
        <EditChallengeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          challenge={selectedChallenge}
          onUpdateChallenge={updateChallenge}
        />
      )}
    </>
  );
};

export default Challenges;
