import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/** Routes that must NEVER be hidden — auto-repaired on every mount/render */
const ALWAYS_VISIBLE = ['/projects', '/rag-architect', '/projects/detector'];

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
  onboarding_completed: boolean;
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
  onboarding_completed: false,
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
  const isRepairing = useRef(false);

  // Auto-repair: ensure ALWAYS_VISIBLE routes are never hidden
  useEffect(() => {
    if (!user || isRepairing.current) return;
    const hidden = settings.hidden_menu_items;
    if (!hidden || hidden.length === 0) return;

    const cleaned = hidden.filter((p) => !ALWAYS_VISIBLE.includes(p));
    if (cleaned.length !== hidden.length) {
      isRepairing.current = true;
      updateSettings({ hidden_menu_items: cleaned }).finally(() => {
        isRepairing.current = false;
      });
    }
  }, [settings.hidden_menu_items, user]);

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
        const rawHidden = (data.hidden_menu_items as string[]) || [];
        const sanitizedHidden = rawHidden.filter((p: string) => !ALWAYS_VISIBLE.includes(p));
        setSettings({
          pomodoro_work_duration: data.pomodoro_work_duration,
          pomodoro_short_break: data.pomodoro_short_break,
          pomodoro_long_break: data.pomodoro_long_break,
          font_size: (data.font_size as FontSize) || "medium",
          language: (data.language as Language) || "es",
          hidden_menu_items: sanitizedHidden,
          show_day_summary: data.show_day_summary ?? true,
          show_quick_actions: data.show_quick_actions ?? true,
          show_notifications_panel: data.show_notifications_panel ?? true,
          show_contacts_card: data.show_contacts_card ?? true,
          onboarding_completed: data.onboarding_completed ?? false,
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

    if (newSettings.hidden_menu_items) {
      newSettings.hidden_menu_items = newSettings.hidden_menu_items.filter(p => !ALWAYS_VISIBLE.includes(p));
    }

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