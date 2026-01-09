import { useState, useEffect } from "react";

export type DashboardCardId = 
  | "check-in"
  | "daily-plan"
  | "publications"
  | "agenda"
  | "challenge"
  | "coach"
  | "priorities"
  | "alerts"
  | "habits-insights";

export type CardSize = "compact" | "normal" | "large";
export type CardWidth = "1/3" | "1/2" | "2/3" | "full";

export type ProfileIconName = 
  | "layout-grid"
  | "briefcase"
  | "home"
  | "user"
  | "star"
  | "heart"
  | "zap"
  | "target"
  | "rocket"
  | "coffee"
  | "sun"
  | "moon"
  | "sparkles"
  | "flame";

export const PROFILE_ICONS: { name: ProfileIconName; label: string }[] = [
  { name: "layout-grid", label: "Grid" },
  { name: "briefcase", label: "Trabajo" },
  { name: "home", label: "Casa" },
  { name: "user", label: "Personal" },
  { name: "star", label: "Favorito" },
  { name: "heart", label: "Favorito" },
  { name: "zap", label: "Energía" },
  { name: "target", label: "Objetivos" },
  { name: "rocket", label: "Productividad" },
  { name: "coffee", label: "Descanso" },
  { name: "sun", label: "Día" },
  { name: "moon", label: "Noche" },
  { name: "sparkles", label: "Especial" },
  { name: "flame", label: "Intenso" },
];

export interface CardSettings {
  size: CardSize;
  width: CardWidth;
  visible: boolean;
}

export interface DashboardLayoutConfig {
  leftColumn: DashboardCardId[];
  rightColumn: DashboardCardId[];
  cardSettings: Record<DashboardCardId, CardSettings>;
}

export interface DashboardProfile {
  id: string;
  name: string;
  icon: ProfileIconName;
  layout: DashboardLayoutConfig;
}

interface DashboardState {
  activeProfileId: string;
  profiles: DashboardProfile[];
}

const DEFAULT_CARD_SETTINGS: Record<DashboardCardId, CardSettings> = {
  "check-in": { size: "normal", width: "full", visible: true },
  "daily-plan": { size: "normal", width: "full", visible: true },
  "publications": { size: "normal", width: "full", visible: true },
  "agenda": { size: "normal", width: "full", visible: true },
  "challenge": { size: "normal", width: "full", visible: true },
  "coach": { size: "normal", width: "full", visible: true },
  "priorities": { size: "normal", width: "full", visible: true },
  "alerts": { size: "compact", width: "full", visible: true },
  "habits-insights": { size: "normal", width: "full", visible: true },
};

export const CARD_LABELS: Record<DashboardCardId, string> = {
  "check-in": "Check-in diario",
  "daily-plan": "Plan del día",
  "publications": "Publicaciones",
  "agenda": "Agenda",
  "challenge": "Retos",
  "coach": "Coach IA",
  "priorities": "Prioridades",
  "alerts": "Alertas",
  "habits-insights": "Insights de Hábitos",
};

const DEFAULT_LAYOUT: DashboardLayoutConfig = {
  leftColumn: ["check-in", "daily-plan", "publications", "habits-insights"],
  rightColumn: ["agenda", "challenge", "coach", "priorities", "alerts"],
  cardSettings: DEFAULT_CARD_SETTINGS,
};

const DEFAULT_PROFILES: DashboardProfile[] = [
  {
    id: "default",
    name: "Principal",
    icon: "layout-grid",
    layout: DEFAULT_LAYOUT,
  },
];

const DEFAULT_STATE: DashboardState = {
  activeProfileId: "default",
  profiles: DEFAULT_PROFILES,
};

const STORAGE_KEY = "dashboard-profiles-v1";

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useDashboardLayout = () => {
  const [state, setState] = useState<DashboardState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.profiles && parsed.activeProfileId) {
          // Ensure all profiles have valid card settings
          const validatedProfiles = parsed.profiles.map((profile: DashboardProfile) => ({
            ...profile,
            layout: {
              ...profile.layout,
              cardSettings: { ...DEFAULT_CARD_SETTINGS, ...profile.layout.cardSettings },
            },
          }));
          setState({
            activeProfileId: parsed.activeProfileId,
            profiles: validatedProfiles,
          });
        }
      }
    } catch (e) {
      console.error("Error loading dashboard profiles:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn("Could not persist dashboard profiles:", e);
      }
    }
  }, [state, isLoaded]);

  // Get active profile
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
  const layout = activeProfile?.layout || DEFAULT_LAYOUT;

  // Profile management
  const createProfile = (name: string, icon: ProfileIconName = "layout-grid") => {
    const newProfile: DashboardProfile = {
      id: generateId(),
      name,
      icon,
      layout: { ...DEFAULT_LAYOUT, cardSettings: { ...DEFAULT_CARD_SETTINGS } },
    };
    setState((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
      activeProfileId: newProfile.id,
    }));
    return newProfile.id;
  };

  const duplicateProfile = (profileId: string, newName: string) => {
    const source = state.profiles.find((p) => p.id === profileId);
    if (!source) return null;

    const newProfile: DashboardProfile = {
      id: generateId(),
      name: newName,
      icon: source.icon,
      layout: JSON.parse(JSON.stringify(source.layout)),
    };
    setState((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
      activeProfileId: newProfile.id,
    }));
    return newProfile.id;
  };

  const setProfileIcon = (profileId: string, icon: ProfileIconName) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === profileId ? { ...p, icon } : p
      ),
    }));
  };

  const renameProfile = (profileId: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === profileId ? { ...p, name: newName } : p
      ),
    }));
  };

  const deleteProfile = (profileId: string) => {
    if (state.profiles.length <= 1) return; // Can't delete last profile
    
    setState((prev) => {
      const newProfiles = prev.profiles.filter((p) => p.id !== profileId);
      const newActiveId = prev.activeProfileId === profileId 
        ? newProfiles[0].id 
        : prev.activeProfileId;
      return {
        activeProfileId: newActiveId,
        profiles: newProfiles,
      };
    });
  };

  const switchProfile = (profileId: string) => {
    setState((prev) => ({
      ...prev,
      activeProfileId: profileId,
    }));
  };

  // Layout operations (operate on active profile)
  const updateActiveLayout = (updater: (layout: DashboardLayoutConfig) => DashboardLayoutConfig) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeProfileId
          ? { ...p, layout: updater(p.layout) }
          : p
      ),
    }));
  };

  const moveCard = (
    cardId: DashboardCardId,
    fromColumn: "left" | "right",
    toColumn: "left" | "right",
    toIndex: number
  ) => {
    updateActiveLayout((prev) => {
      const newLayout = { ...prev };
      const fromKey = fromColumn === "left" ? "leftColumn" : "rightColumn";
      const toKey = toColumn === "left" ? "leftColumn" : "rightColumn";

      newLayout[fromKey] = prev[fromKey].filter((id) => id !== cardId);

      if (fromColumn === toColumn) {
        newLayout[toKey] = [...newLayout[toKey]];
        newLayout[toKey].splice(toIndex, 0, cardId);
      } else {
        newLayout[toKey] = [...prev[toKey]];
        newLayout[toKey].splice(toIndex, 0, cardId);
      }

      return newLayout;
    });
  };

  const reorderInColumn = (
    column: "left" | "right",
    oldIndex: number,
    newIndex: number
  ) => {
    updateActiveLayout((prev) => {
      const key = column === "left" ? "leftColumn" : "rightColumn";
      const newOrder = [...prev[key]];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);
      return { ...prev, [key]: newOrder };
    });
  };

  const setCardSize = (cardId: DashboardCardId, size: CardSize) => {
    updateActiveLayout((prev) => ({
      ...prev,
      cardSettings: {
        ...prev.cardSettings,
        [cardId]: { ...prev.cardSettings[cardId], size },
      },
    }));
  };

  const setCardWidth = (cardId: DashboardCardId, width: CardWidth) => {
    updateActiveLayout((prev) => ({
      ...prev,
      cardSettings: {
        ...prev.cardSettings,
        [cardId]: { ...prev.cardSettings[cardId], width },
      },
    }));
  };

  const setCardVisibility = (cardId: DashboardCardId, visible: boolean) => {
    updateActiveLayout((prev) => ({
      ...prev,
      cardSettings: {
        ...prev.cardSettings,
        [cardId]: { ...prev.cardSettings[cardId], visible },
      },
    }));
  };

  const resetLayout = () => {
    updateActiveLayout(() => ({ ...DEFAULT_LAYOUT, cardSettings: { ...DEFAULT_CARD_SETTINGS } }));
  };

  const visibleLeftCards = layout.leftColumn.filter(
    (id) => layout.cardSettings[id]?.visible !== false
  );
  const visibleRightCards = layout.rightColumn.filter(
    (id) => layout.cardSettings[id]?.visible !== false
  );

  return {
    // Profile data
    profiles: state.profiles,
    activeProfile,
    activeProfileId: state.activeProfileId,
    
    // Layout data
    layout,
    visibleLeftCards,
    visibleRightCards,
    isLoaded,
    
    // Profile operations
    createProfile,
    duplicateProfile,
    renameProfile,
    setProfileIcon,
    deleteProfile,
    switchProfile,
    
    // Layout operations
    moveCard,
    reorderInColumn,
    setCardSize,
    setCardWidth,
    setCardVisibility,
    resetLayout,
  };
};
