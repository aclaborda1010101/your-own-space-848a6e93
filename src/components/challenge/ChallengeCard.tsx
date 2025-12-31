import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Target,
  Plus,
  Flame,
  Calendar,
  Trophy,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  Compass,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { ChallengeWithProgress } from "@/hooks/useJarvisChallenge";
import { CreateChallengeDialog } from "./CreateChallengeDialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ChallengeCardProps {
  challenges: ChallengeWithProgress[];
  loading: boolean;
  onCreateChallenge: (
    name: string,
    durationDays: number,
    goals: { title: string; description?: string; frequency?: string; targetCount?: number; goalType?: string }[],
    options?: {
      description?: string;
      motivation?: string;
      reward?: string;
    }
  ) => Promise<unknown>;
  onToggleGoal: (challengeId: string, goalId: string, completed: boolean) => void;
}

const goalTypeConfig: Record<string, { color: string; bgColor: string; icon: typeof Target; label: string }> = {
  objetivo: { color: "text-success", bgColor: "bg-success/20", icon: CheckCircle, label: "Objetivo" },
  proposito: { color: "text-primary", bgColor: "bg-primary/20", icon: Compass, label: "Propósito" },
  prohibicion: { color: "text-destructive", bgColor: "bg-destructive/20", icon: Ban, label: "Prohibición" },
  excepcion: { color: "text-warning", bgColor: "bg-warning/20", icon: ShieldCheck, label: "Excepción" },
};

export const ChallengeCard = ({
  challenges,
  loading,
  onCreateChallenge,
  onToggleGoal,
}: ChallengeCardProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedChallenges, setExpandedChallenges] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeChallenges = challenges.filter((c) => c.status === "active");
  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-warning" />
              </div>
              JARVIS Reto
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeChallenges.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-foreground font-medium">Sin retos activos</p>
                <p className="text-sm text-muted-foreground">
                  Crea tu primer reto para empezar
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear reto
              </Button>
            </div>
          ) : (
            activeChallenges.map((challenge) => {
              const isExpanded = expandedChallenges.has(challenge.id);
              const todayLogs = challenge.logs.filter(
                (l) => l.date === today && l.completed
              );
              const completedGoalIds = new Set(todayLogs.map((l) => l.goal_id));

              return (
                <Collapsible
                  key={challenge.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(challenge.id)}
                >
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    {/* Header */}
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-start justify-between">
                        <div className="text-left">
                          <h4 className="font-medium text-foreground">
                            {challenge.name}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {challenge.duration_days} días
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {challenge.progress.currentStreak > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-destructive/10 text-destructive border-destructive/20"
                            >
                              <Flame className="w-3 h-3 mr-1" />
                              {challenge.progress.currentStreak}
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Día {challenge.progress.daysElapsed + 1}</span>
                        <span>{challenge.progress.percentComplete}%</span>
                      </div>
                      <Progress value={challenge.progress.percentComplete} className="h-2" />
                    </div>

                    {/* Today's Goals */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Hoy: {challenge.progress.todayCompleted}/{challenge.progress.todayTotal}
                      </span>
                    </div>

                    {/* Expanded Content */}
                    <CollapsibleContent className="space-y-3 pt-2">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-foreground">
                            {challenge.progress.daysElapsed}
                          </p>
                          <p className="text-xs text-muted-foreground">Días</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-foreground">
                            {challenge.progress.currentStreak}
                          </p>
                          <p className="text-xs text-muted-foreground">Racha</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-foreground">
                            {challenge.progress.daysRemaining}
                          </p>
                          <p className="text-xs text-muted-foreground">Faltan</p>
                        </div>
                      </div>

                      {/* Goals Checklist by Type */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">
                          Elementos del reto
                        </p>
                        {Object.entries(goalTypeConfig).map(([type, config]) => {
                          const typeGoals = challenge.goals.filter(g => g.goal_type === type);
                          if (typeGoals.length === 0) return null;
                          
                          const Icon = config.icon;
                          return (
                            <div key={type} className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                                <span className={`text-xs font-medium ${config.color}`}>
                                  {config.label}
                                </span>
                              </div>
                              <div className="space-y-1 pl-5">
                                {typeGoals.map((goal) => {
                                  const isCompleted = completedGoalIds.has(goal.id);
                                  return (
                                    <div
                                      key={goal.id}
                                      className={`flex items-center gap-2 p-2 rounded-lg ${config.bgColor} transition-colors`}
                                    >
                                      <Checkbox
                                        checked={isCompleted}
                                        onCheckedChange={(checked) =>
                                          onToggleGoal(challenge.id, goal.id, !!checked)
                                        }
                                      />
                                      <span
                                        className={`text-sm flex-1 ${
                                          isCompleted
                                            ? "line-through text-muted-foreground"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {goal.title}
                                      </span>
                                      {goal.frequency === "global" && goal.target_count && (
                                        <Badge variant="outline" className="text-xs">
                                          Meta: {goal.target_count}
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Motivation */}
                      {challenge.motivation && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm text-muted-foreground italic">
                            💪 {challenge.motivation}
                          </p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>

      <CreateChallengeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreateChallenge={onCreateChallenge}
      />
    </>
  );
};
