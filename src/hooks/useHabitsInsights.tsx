import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface HabitInsight {
  id: string;
  user_id: string;
  insight_type: string;
  category: string | null;
  title: string;
  description: string | null;
  evidence: Record<string, unknown>;
  confidence_score: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPattern {
  id: string;
  user_id: string;
  week_start: string;
  patterns: Record<string, unknown>;
  metrics: {
    avgEnergy?: number;
    avgFocus?: number;
    avgMood?: number;
    completionRate?: number;
  };
  summary: string | null;
  created_at: string;
}

export const useHabitsInsights = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch active insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ["habit-insights", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("habit_insights")
        .select("*")
        .eq("is_active", true)
        .order("confidence_score", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as HabitInsight[];
    },
    enabled: !!user?.id,
  });

  // Fetch recent weekly patterns
  const { data: weeklyPatterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ["weekly-patterns", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(4);

      if (error) throw error;
      return data as WeeklyPattern[];
    },
    enabled: !!user?.id,
  });

  // Trigger habit analysis
  const analyzeHabits = useCallback(async () => {
    if (!user?.id) return;
    
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("habits-analyzer", {
        body: { action: "analyze" },
      });

      if (error) throw error;
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["habit-insights"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-patterns"] });
      
      toast.success("Análisis de hábitos completado");
      return data;
    } catch (error) {
      console.error("Error analyzing habits:", error);
      toast.error("Error al analizar hábitos");
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, [user?.id, queryClient]);

  // Query about habits
  const askAboutHabits = useCallback(async (question: string) => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke("habits-analyzer", {
        body: { action: "query", question },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error querying habits:", error);
      return null;
    }
  }, [user?.id]);

  // Dismiss an insight
  const dismissInsight = useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from("habit_insights")
        .update({ is_active: false })
        .eq("id", insightId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-insights"] });
    },
  });

  // Get current week's pattern
  const currentWeekPattern = weeklyPatterns[0] || null;

  // Get top insights by category
  const topInsights = insights.slice(0, 3);

  // Calculate streak from weekly patterns
  const weeksWithData = weeklyPatterns.filter(
    (p) => (p.metrics?.completionRate || 0) > 0
  ).length;

  return {
    insights,
    weeklyPatterns,
    currentWeekPattern,
    topInsights,
    weeksWithData,
    isLoading: insightsLoading || patternsLoading,
    isAnalyzing,
    analyzeHabits,
    askAboutHabits,
    dismissInsight: dismissInsight.mutate,
  };
};
