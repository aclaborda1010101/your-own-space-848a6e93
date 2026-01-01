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
  // New fields for complete JARVIS configuration
  current_mode: string;
  mode_activated_at: string | null;
  daily_routine: Json;
  special_days: Json;
  rest_rules: Json;
  bosco_settings: Json;
  planning_rules: Json;
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
  current_mode: string;
  mode_activated_at: string | null;
  daily_routine: Json;
  special_days: Json;
  rest_rules: Json;
  bosco_settings: Json;
  planning_rules: Json;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROFILE = {
  name: "Agustín",
  vital_role: "Emprendedor creativo y padre",
  current_context: null,
  cognitive_style: "analítico-creativo",
  primary_language: "es",
  secondary_language: "en",
  personal_principles: [
    "Claridad sobre complejidad",
    "Sostenibilidad sobre productividad máxima",
    "Familia primero",
    "Progreso no perfección"
  ],
  life_goals: [
    "Criar bien a Bosco",
    "Mantener energía estable",
    "Vivir con intención"
  ],
  professional_goals: [
    "Escalar proyecto actual",
    "Mejorar nivel de inglés",
    "Generar contenido de valor"
  ],
  family_context: {
    hijo: "Bosco",
    edad_hijo: "4.5 años",
    tiempo_diario_minimo: 120,
    actividades_prioridad: ["vínculo", "lectura", "inglés_lúdico"]
  },
  health_profile: {
    entrenamiento: "regular",
    tipo: "fuerza + actividad moderada",
    despertar: "05:00",
    siesta_condicional: true
  },
  food_preferences: {},
  food_dislikes: [],
  best_focus_time: "morning",
  fatigue_time: "afternoon",
  needs_buffers: true,
  communication_style: {
    tono_preferido: "directo_humano",
    evitar: ["frases_vacias", "motivacion_artificial", "exceso_opciones"]
  },
  personal_rules: [
    "No más de 3 prioridades laborales al día",
    "Nunca eliminar bloques familiares",
    "Si hay cansancio, simplificar",
    "Si hay urgencia familiar, modo supervivencia",
    "Buffers diarios obligatorios"
  ],
  auto_decisions: [
    "Reordenar tareas",
    "Mover bloques P1/P2",
    "Activar siesta si aplica regla",
    "Ajustar actividades de Bosco",
    "Bajar exigencia diaria"
  ],
  require_confirmation: [
    "Quitar tiempo con Bosco",
    "Saltarse entrenamiento sin causa",
    "Cambiar rutinas base",
    "Decisiones financieras",
    "Forzar actividades educativas"
  ],
  learned_patterns: {},
  emotional_history: [],
  current_mode: "normal",
  mode_activated_at: null,
  daily_routine: {
    despertar: "05:00",
    tiempo_personal: { inicio: "05:00", fin: "06:30" },
    entrenamiento: { inicio: "06:45", fin: "07:30" },
    preparacion: { inicio: "07:30", fin: "07:50" },
    desayuno_bosco: { inicio: "07:50", fin: "08:10" },
    salida_cole: { inicio: "08:10", fin: "08:55" },
    trayecto: { inicio: "08:55", fin: "09:20" },
    trabajo_profundo: { inicio: "09:30", fin: "14:00" },
    comida: { inicio: "14:00", fin: "14:30" },
    siesta: { inicio: "14:30", fin: "16:30", condicional: true },
    reentrada: { inicio: "16:30", fin: "17:00" },
    tiempo_bosco: { inicio: "17:10", fin: "19:10" },
    cena: { inicio: "19:00", fin: "19:30" },
    bano_bosco: "20:15",
    bosco_duerme: { inicio: "21:00", fin: "21:30" },
    cierre_dia: { inicio: "21:30", fin: "22:15" }
  },
  special_days: {
    jueves: {
      natacion: { inicio: "17:00", fin: "17:30" },
      vuelta: { inicio: "17:30", fin: "17:50" },
      ajustar_bosco: true
    }
  },
  rest_rules: {
    siesta_si_sueno_menor_7h: true,
    reducir_carga_sin_siesta: true,
    eliminar_p2_si_cansado: true
  },
  bosco_settings: {
    duracion_diaria: 120,
    idiomas: ["castellano", "ingles"],
    alternar_idioma: true,
    no_forzar_resistencia: true,
    priorizar_disfrute: true,
    ia_semanal: { frecuencia: "1-2", max_duracion: 15 }
  },
  planning_rules: {
    max_prioridades_dia: 3,
    buffers_obligatorios: true,
    proteger_familia: true,
    simplificar_si_cansado: true,
    modo_supervivencia_si_urgencia: true
  }
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
