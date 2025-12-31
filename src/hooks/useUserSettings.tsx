import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserSettings {
  pomodoro_work_duration: number;
  pomodoro_short_break: number;
  pomodoro_long_break: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  pomodoro_work_duration: 25,
  pomodoro_short_break: 5,
  pomodoro_long_break: 15,
};

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export const UserSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          pomodoro_work_duration: data.pomodoro_work_duration,
          pomodoro_short_break: data.pomodoro_short_break,
          pomodoro_long_break: data.pomodoro_long_break,
        });
      } else {
        // Create default settings for new user
        const { error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            ...DEFAULT_SETTINGS,
          });

        if (insertError) throw insertError;
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_settings")
        .update(newSettings)
        .eq("user_id", user.id);

      if (error) throw error;

      setSettings((prev) => ({ ...prev, ...newSettings }));
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
  };

  return (
    <UserSettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error("useUserSettings must be used within UserSettingsProvider");
  }
  return context;
};