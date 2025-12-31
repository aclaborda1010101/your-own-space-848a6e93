import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface Challenge {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "abandoned";
  motivation: string | null;
  reward: string | null;
  created_at: string;
}

export interface ChallengeGoal {
  id: string;
  challenge_id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "once" | "global";
  goal_type: "objetivo" | "proposito" | "prohibicion" | "excepcion";
  target_count: number;
  sort_order: number;
}

export interface ChallengeLog {
  id: string;
  challenge_id: string;
  goal_id: string | null;
  date: string;
  completed: boolean;
  notes: string | null;
  mood: number | null;
}

export interface ChallengeWithProgress extends Challenge {
  goals: ChallengeGoal[];
  logs: ChallengeLog[];
  progress: {
    daysElapsed: number;
    daysRemaining: number;
    percentComplete: number;
    currentStreak: number;
    longestStreak: number;
    todayCompleted: number;
    todayTotal: number;
  };
}

export const useJarvisChallenge = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateProgress = (
    challenge: Challenge,
    goals: ChallengeGoal[],
    logs: ChallengeLog[]
  ): ChallengeWithProgress["progress"] => {
    const today = new Date();
    const startDate = new Date(challenge.start_date);
    const endDate = new Date(challenge.end_date);
    
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const percentComplete = Math.min(100, Math.round((daysElapsed / challenge.duration_days) * 100));

    // Calculate streaks
    const dailyGoals = goals.filter(g => g.frequency === "daily");
    const globalGoals = goals.filter(g => g.frequency === "global");
    const todayStr = today.toISOString().split("T")[0];
    
    const todayLogs = logs.filter(l => l.date === todayStr && l.completed);
    const todayCompleted = todayLogs.filter(l => {
      const goal = goals.find(g => g.id === l.goal_id);
      return goal?.frequency === "daily";
    }).length;
    const todayTotal = dailyGoals.length;

    // Calculate current streak (consecutive days with all daily goals completed)
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (let d = daysElapsed; d >= 0; d--) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + d);
      const dateStr = checkDate.toISOString().split("T")[0];
      
      const dayLogs = logs.filter(l => l.date === dateStr && l.completed);
      const allCompleted = dailyGoals.length > 0 && dayLogs.length >= dailyGoals.length;
      
      if (allCompleted) {
        tempStreak++;
        if (d === daysElapsed || d === daysElapsed - 1) {
          currentStreak = tempStreak;
        }
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
        if (d === daysElapsed || d === daysElapsed - 1) {
          currentStreak = 0;
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      daysElapsed,
      daysRemaining,
      percentComplete,
      currentStreak,
      longestStreak,
      todayCompleted,
      todayTotal,
    };
  };

  const fetchChallenges = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch challenges
      const { data: challengesData, error: challengesError } = await supabase
        .from("challenges")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (challengesError) throw challengesError;

      // Fetch goals and logs for each challenge
      const challengesWithProgress: ChallengeWithProgress[] = await Promise.all(
        (challengesData || []).map(async (challenge) => {
          const [goalsRes, logsRes] = await Promise.all([
            supabase
              .from("challenge_goals")
              .select("*")
              .eq("challenge_id", challenge.id)
              .order("sort_order"),
            supabase
              .from("challenge_logs")
              .select("*")
              .eq("challenge_id", challenge.id),
          ]);

          const goals = (goalsRes.data || []) as ChallengeGoal[];
          const logs = (logsRes.data || []) as ChallengeLog[];
          const progress = calculateProgress(challenge as Challenge, goals, logs);

          return {
            ...challenge,
            goals,
            logs,
            progress,
          } as ChallengeWithProgress;
        })
      );

      setChallenges(challengesWithProgress);
    } catch (err) {
      console.error("Error fetching challenges:", err);
      setError("Error al cargar los retos");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const createChallenge = async (
    name: string,
    durationDays: number,
    goals: { title: string; description?: string; frequency?: string; targetCount?: number; goalType?: string }[],
    options?: {
      description?: string;
      motivation?: string;
      reward?: string;
    }
  ) => {
    if (!user) return null;

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .insert({
          user_id: user.id,
          name,
          description: options?.description,
          duration_days: durationDays,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          motivation: options?.motivation,
          reward: options?.reward,
        } as never)
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Create goals
      if (goals.length > 0 && challenge) {
        const goalsToInsert = goals.map((g, i) => ({
          challenge_id: challenge.id,
          user_id: user.id,
          title: g.title,
          description: g.description,
          frequency: g.frequency || "daily",
          goal_type: g.goalType || "objetivo",
          target_count: g.targetCount || 1,
          sort_order: i,
        }));

        const { error: goalsError } = await supabase
          .from("challenge_goals")
          .insert(goalsToInsert as never);

        if (goalsError) throw goalsError;
      }

      toast.success("Reto creado", {
        description: `${name} - ${durationDays} días`,
      });

      await fetchChallenges();
      return challenge;
    } catch (err) {
      console.error("Error creating challenge:", err);
      toast.error("Error al crear el reto");
      return null;
    }
  };

  const toggleGoalCompletion = async (
    challengeId: string,
    goalId: string,
    completed: boolean
  ) => {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    try {
      if (completed) {
        // Create or update log as completed
        const { error } = await supabase
          .from("challenge_logs")
          .upsert({
            challenge_id: challengeId,
            goal_id: goalId,
            user_id: user.id,
            date: today,
            completed: true,
          } as never, {
            onConflict: "goal_id,date",
          });

        if (error) throw error;
      } else {
        // Update log as not completed
        const { error } = await supabase
          .from("challenge_logs")
          .update({ completed: false })
          .eq("goal_id", goalId)
          .eq("date", today);

        if (error) throw error;
      }

      await fetchChallenges();
    } catch (err) {
      console.error("Error toggling goal:", err);
      toast.error("Error al actualizar el objetivo");
    }
  };

  const updateChallengeStatus = async (
    challengeId: string,
    status: "active" | "completed" | "abandoned"
  ) => {
    try {
      const { error } = await supabase
        .from("challenges")
        .update({ status })
        .eq("id", challengeId);

      if (error) throw error;

      toast.success(
        status === "completed" 
          ? "¡Reto completado!" 
          : status === "abandoned" 
            ? "Reto abandonado" 
            : "Reto reactivado"
      );

      await fetchChallenges();
    } catch (err) {
      console.error("Error updating challenge:", err);
      toast.error("Error al actualizar el reto");
    }
  };

  const updateChallenge = async (
    challengeId: string,
    updates: {
      name?: string;
      description?: string;
      motivation?: string;
      reward?: string;
    },
    goals?: { 
      id?: string; 
      title: string; 
      description?: string; 
      frequency?: string; 
      targetCount?: number; 
      goalType?: string;
      deleted?: boolean;
    }[]
  ) => {
    if (!user) return;

    try {
      // Update challenge fields
      const { error: challengeError } = await supabase
        .from("challenges")
        .update({
          name: updates.name,
          description: updates.description,
          motivation: updates.motivation,
          reward: updates.reward,
          updated_at: new Date().toISOString(),
        })
        .eq("id", challengeId);

      if (challengeError) throw challengeError;

      // Handle goals if provided
      if (goals) {
        for (const goal of goals) {
          if (goal.deleted && goal.id) {
            // Delete existing goal
            await supabase.from("challenge_goals").delete().eq("id", goal.id);
          } else if (goal.id && !goal.deleted) {
            // Update existing goal
            await supabase
              .from("challenge_goals")
              .update({
                title: goal.title,
                description: goal.description,
                frequency: goal.frequency || "daily",
                goal_type: goal.goalType || "objetivo",
                target_count: goal.targetCount || 1,
              })
              .eq("id", goal.id);
          } else if (!goal.id && !goal.deleted && goal.title.trim()) {
            // Create new goal
            await supabase.from("challenge_goals").insert({
              challenge_id: challengeId,
              user_id: user.id,
              title: goal.title,
              description: goal.description,
              frequency: goal.frequency || "daily",
              goal_type: goal.goalType || "objetivo",
              target_count: goal.targetCount || 1,
              sort_order: 0,
            } as never);
          }
        }
      }

      toast.success("Reto actualizado");
      await fetchChallenges();
    } catch (err) {
      console.error("Error updating challenge:", err);
      toast.error("Error al actualizar el reto");
    }
  };

  const deleteChallenge = async (challengeId: string) => {
    try {
      const { error } = await supabase
        .from("challenges")
        .delete()
        .eq("id", challengeId);

      if (error) throw error;

      toast.success("Reto eliminado");
      await fetchChallenges();
    } catch (err) {
      console.error("Error deleting challenge:", err);
      toast.error("Error al eliminar el reto");
    }
  };

  const activeChallenges = challenges.filter(c => c.status === "active");
  const completedChallenges = challenges.filter(c => c.status === "completed");

  return {
    challenges,
    activeChallenges,
    completedChallenges,
    loading,
    error,
    createChallenge,
    updateChallenge,
    toggleGoalCompletion,
    updateChallengeStatus,
    deleteChallenge,
    refetch: fetchChallenges,
  };
};
