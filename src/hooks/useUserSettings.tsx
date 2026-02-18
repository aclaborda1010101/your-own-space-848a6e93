import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type FontSize = "small" | "medium" | "large";
export type Language = "es" | "en";

export interface UserSettings {
  pomodoro_work_duration: number;
  pomodoro_short_break: number;
  pomodoro_long_break: number;
  font_size: FontSize;
  language: Language;
  hidden_menu_items: string[];
  show_day_summary: boolean;
  show_quick_actions: boolean;
  show_notifications_panel: boolean;
  show_contacts_card: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  pomodoro_work_duration: 25,
  pomodoro_short_break: 5,
  pomodoro_long_break: 15,
  font_size: "medium",
  language: "es",
  hidden_menu_items: [],
  show_day_summary: true,
  show_quick_actions: true,
  show_notifications_panel: true,
  show_contacts_card: true,
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

  // Apply font size to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("text-sm", "text-base", "text-lg");
    
    switch (settings.font_size) {
      case "small":
        root.classList.add("text-sm");
        break;
      case "large":
        root.classList.add("text-lg");
        break;
      default:
        root.classList.add("text-base");
    }
  }, [settings.font_size]);

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
          font_size: (data.font_size as FontSize) || "medium",
          language: (data.language as Language) || "es",
          hidden_menu_items: (data.hidden_menu_items as string[]) || [],
          show_day_summary: data.show_day_summary ?? true,
          show_quick_actions: data.show_quick_actions ?? true,
          show_notifications_panel: data.show_notifications_panel ?? true,
          show_contacts_card: data.show_contacts_card ?? true,
        });
      } else {
        // Create default settings for new user
        const { error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            pomodoro_work_duration: DEFAULT_SETTINGS.pomodoro_work_duration,
            pomodoro_short_break: DEFAULT_SETTINGS.pomodoro_short_break,
            pomodoro_long_break: DEFAULT_SETTINGS.pomodoro_long_break,
            font_size: DEFAULT_SETTINGS.font_size,
            language: DEFAULT_SETTINGS.language,
            hidden_menu_items: DEFAULT_SETTINGS.hidden_menu_items,
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