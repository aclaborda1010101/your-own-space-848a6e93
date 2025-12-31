import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CheckInData {
  energy: number;
  mood: number;
  focus: number;
  availableTime: number;
  interruptionRisk: "low" | "medium" | "high";
  dayMode: "balanced" | "push" | "survival";
}

const defaultCheckIn: CheckInData = {
  energy: 3,
  mood: 3,
  focus: 3,
  availableTime: 8,
  interruptionRisk: "low",
  dayMode: "balanced",
};

export const useCheckIn = () => {
  const { user } = useAuth();
  const [checkIn, setCheckIn] = useState<CheckInData>(defaultCheckIn);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (user) {
      fetchTodayCheckIn();
    }
  }, [user]);

  const fetchTodayCheckIn = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCheckIn({
          energy: data.energy,
          mood: data.mood,
          focus: data.focus,
          availableTime: data.available_time,
          interruptionRisk: data.interruption_risk as "low" | "medium" | "high",
          dayMode: data.day_mode as "balanced" | "push" | "survival",
        });
      }
    } catch (error: any) {
      console.error("Error fetching check-in:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveCheckIn = async (data: CheckInData) => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("check_ins")
        .upsert({
          user_id: user.id,
          date: today,
          energy: data.energy,
          mood: data.mood,
          focus: data.focus,
          available_time: data.availableTime,
          interruption_risk: data.interruptionRisk,
          day_mode: data.dayMode,
        }, {
          onConflict: "user_id,date"
        });

      if (error) throw error;
      
      setCheckIn(data);
      toast.success("Check-in guardado");
    } catch (error: any) {
      console.error("Error saving check-in:", error);
      toast.error("Error al guardar el check-in");
    } finally {
      setSaving(false);
    }
  };

  return {
    checkIn,
    setCheckIn: saveCheckIn,
    loading,
    saving,
  };
};
