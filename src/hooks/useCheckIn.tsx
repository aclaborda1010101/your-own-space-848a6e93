import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { getTodayLocal } from "@/lib/dateUtils";
import { useJarvisWhoopData } from "./useJarvisWhoopData";
import { mapWhoopToCheckIn } from "@/lib/whoopToCheckIn";
import { isAbortError } from "@/lib/isAbortError";

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
  const { data: whoopData, hasData: hasWhoopData } = useJarvisWhoopData();
  const [checkIn, setCheckInState] = useState<CheckInData>(defaultCheckIn);
  const [draftCheckIn, setDraftCheckIn] = useState<CheckInData>(defaultCheckIn);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [prefilledFromWhoop, setPrefilledFromWhoop] = useState(false);

  const today = getTodayLocal();

  // Pre-fill from WHOOP when no check-in exists
  useEffect(() => {
    if (!isRegistered && !loading && hasWhoopData && whoopData) {
      const mapped = mapWhoopToCheckIn(whoopData);
      const whoopDefaults: CheckInData = {
        energy: mapped.energy,
        mood: mapped.mood,
        focus: mapped.focus,
        availableTime: mapped.availableTime,
        interruptionRisk: mapped.interruptionRisk,
        dayMode: mapped.dayMode,
      };
      setDraftCheckIn(whoopDefaults);
      setPrefilledFromWhoop(true);
    }
  }, [isRegistered, loading, hasWhoopData, whoopData]);

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
        .select("energy, mood, focus, available_time, interruption_risk, day_mode")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const checkInData = {
          energy: data.energy,
          mood: data.mood,
          focus: data.focus,
          availableTime: data.available_time,
          interruptionRisk: data.interruption_risk as "low" | "medium" | "high",
          dayMode: data.day_mode as "balanced" | "push" | "survival",
        };
        setCheckInState(checkInData);
        setDraftCheckIn(checkInData);
        setIsRegistered(true);
        setPrefilledFromWhoop(false);
      } else {
        setIsRegistered(false);
      }
    } catch (error: any) {
      if (isAbortError(error)) return;
      console.error("Error fetching check-in:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = useCallback((data: CheckInData) => {
    setDraftCheckIn(data);
    setPrefilledFromWhoop(false);
  }, []);

  const registerCheckIn = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("check_ins")
        .upsert({
          user_id: user.id,
          date: today,
          energy: draftCheckIn.energy,
          mood: draftCheckIn.mood,
          focus: draftCheckIn.focus,
          available_time: draftCheckIn.availableTime,
          interruption_risk: draftCheckIn.interruptionRisk,
          day_mode: draftCheckIn.dayMode,
        }, {
          onConflict: "user_id,date"
        });

      if (error) throw error;
      
      setCheckInState(draftCheckIn);
      setIsRegistered(true);
      setPrefilledFromWhoop(false);
      toast.success("Check-in registrado correctamente");
    } catch (error: any) {
      console.error("Error saving check-in:", error);
      toast.error("Error al registrar el check-in");
    } finally {
      setSaving(false);
    }
  };

  return {
    checkIn: isRegistered ? checkIn : draftCheckIn,
    draftCheckIn,
    setCheckIn: updateDraft,
    registerCheckIn,
    refetch: fetchTodayCheckIn,
    loading,
    saving,
    isRegistered,
    prefilledFromWhoop,
  };
};
