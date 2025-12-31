import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface UserProfile {
  id: string;
  user_id: string;
  name: string | null;
  vital_role: string | null;
  current_context: string | null;
  cognitive_style: string | null;
  primary_language: string;
  secondary_language: string;
  personal_principles: Json;
  life_goals: Json;
  professional_goals: Json;
  family_context: Json;
  health_profile: Json;
  food_preferences: Json;
  food_dislikes: Json;
  best_focus_time: string;
  fatigue_time: string;
  needs_buffers: boolean;
  communication_style: Json;
  personal_rules: Json;
  auto_decisions: Json;
  require_confirmation: Json;
  learned_patterns: Json;
  emotional_history: Json;
  created_at: string;
  updated_at: string;
}

// Raw database row type
interface UserProfileRow {
  id: string;
  user_id: string;
  name: string | null;
  vital_role: string | null;
  current_context: string | null;
  cognitive_style: string | null;
  primary_language: string;
  secondary_language: string;
  personal_principles: Json;
  life_goals: Json;
  professional_goals: Json;
  family_context: Json;
  health_profile: Json;
  food_preferences: Json;
  food_dislikes: Json;
  best_focus_time: string;
  fatigue_time: string;
  needs_buffers: boolean;
  communication_style: Json;
  personal_rules: Json;
  auto_decisions: Json;
  require_confirmation: Json;
  learned_patterns: Json;
  emotional_history: Json;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROFILE = {
  name: null,
  vital_role: null,
  current_context: null,
  cognitive_style: null,
  primary_language: "es",
  secondary_language: "en",
  personal_principles: [],
  life_goals: [],
  professional_goals: [],
  family_context: {},
  health_profile: {},
  food_preferences: {},
  food_dislikes: [],
  best_focus_time: "morning",
  fatigue_time: "afternoon",
  needs_buffers: true,
  communication_style: {},
  personal_rules: [],
  auto_decisions: [
    "Reordenar tareas",
    "Ajustar bloques horarios",
    "Sugerir bajar ritmo",
    "Proponer comidas",
    "Proponer contenido",
    "Activar buffers",
    "Recordar objetivos",
    "Avisar de riesgos"
  ],
  require_confirmation: [
    "Quitar tiempo familiar",
    "Cambiar dieta drásticamente",
    "Decisiones financieras",
    "Aceptar compromisos externos",
    "Cancelar reuniones importantes"
  ],
  learned_patterns: {},
  emotional_history: []
};

export const useUserProfile = (): {
  profile: UserProfile | null;
  loading: boolean;
  saving: boolean;
  updateProfile: (updates: Partial<UserProfileRow>) => Promise<boolean>;
  addLearnedPattern: (key: string, value: unknown) => Promise<void>;
  addEmotionalEntry: (entry: unknown) => Promise<void>;
} => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_profile")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile(data as UserProfile);
        } else {
          // Create default profile
          const newProfile = {
            user_id: user.id,
            ...DEFAULT_PROFILE
          };

          const { data: created, error: createError } = await supabase
            .from("user_profile")
            .insert(newProfile)
            .select()
            .single();

          if (createError) throw createError;
          setProfile(created as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_profile")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast.success("Perfil actualizado");
      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, profile]);

  // Add to learned patterns
  const addLearnedPattern = useCallback(async (key: string, value: unknown) => {
    if (!profile) return;

    const currentPatterns = (profile.learned_patterns && typeof profile.learned_patterns === 'object' && !Array.isArray(profile.learned_patterns)) 
      ? profile.learned_patterns as Record<string, Json>
      : {};

    const newPatterns = {
      ...currentPatterns,
      [key]: value as Json
    };

    await updateProfile({ learned_patterns: newPatterns });
  }, [profile, updateProfile]);

  // Add to emotional history
  const addEmotionalEntry = useCallback(async (entry: unknown) => {
    if (!profile) return;

    const currentHistory = Array.isArray(profile.emotional_history) ? profile.emotional_history : [];
    const newHistory = [
      ...currentHistory.slice(-49), // Keep last 50 entries
      { ...(entry as object), timestamp: new Date().toISOString() }
    ];

    await updateProfile({ emotional_history: newHistory });
  }, [profile, updateProfile]);

  return {
    profile,
    loading,
    saving,
    updateProfile,
    addLearnedPattern,
    addEmotionalEntry
  };
};
