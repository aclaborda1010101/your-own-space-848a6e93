import { useState, useEffect } from "react";

export type DashboardCardId = 
  | "check-in"
  | "daily-plan"
  | "publications"
  | "agenda"
  | "challenge"
  | "coach"
  | "priorities"
  | "alerts";

export type CardSize = "compact" | "normal" | "large";
export type CardWidth = "1/3" | "1/2" | "2/3" | "full";

export interface CardSettings {
  size: CardSize;
  width: CardWidth;
  visible: boolean;
}

interface DashboardLayout {
  leftColumn: DashboardCardId[];
  rightColumn: DashboardCardId[];
  cardSettings: Record<DashboardCardId, CardSettings>;
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
};

const DEFAULT_LAYOUT: DashboardLayout = {
  leftColumn: ["check-in", "daily-plan", "publications"],
  rightColumn: ["agenda", "challenge", "coach", "priorities", "alerts"],
  cardSettings: DEFAULT_CARD_SETTINGS,
};

const STORAGE_KEY = "dashboard-layout-v3";

export const useDashboardLayout = () => {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.leftColumn && parsed.rightColumn) {
          setLayout({
            leftColumn: parsed.leftColumn,
            rightColumn: parsed.rightColumn,
            cardSettings: { ...DEFAULT_CARD_SETTINGS, ...parsed.cardSettings },
          });
        }
      }
    } catch (e) {
      console.error("Error loading dashboard layout:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when layout changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
  }, [layout, isLoaded]);

  const moveCard = (
    cardId: DashboardCardId,
    fromColumn: "left" | "right",
    toColumn: "left" | "right",
    toIndex: number
  ) => {
    setLayout((prev) => {
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
    setLayout((prev) => {
      const key = column === "left" ? "leftColumn" : "rightColumn";
      const newOrder = [...prev[key]];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);
      return { ...prev, [key]: newOrder };
    });
  };

  const setCardSize = (cardId: DashboardCardId, size: CardSize) => {
    setLayout((prev) => ({
      ...prev,
      cardSettings: {
        ...prev.cardSettings,
        [cardId]: { ...prev.cardSettings[cardId], size },
      },
    }));
  };

  const setCardWidth = (cardId: DashboardCardId, width: CardWidth) => {
    setLayout((prev) => ({
      ...prev,
      cardSettings: {
        ...prev.cardSettings,
        [cardId]: { ...prev.cardSettings[cardId], width },
      },
    }));
  };

  const setCardVisibility = (cardId: DashboardCardId, visible: boolean) => {
    setLayout((prev) => ({
      ...prev,
      cardSettings: {
        ...prev.cardSettings,
        [cardId]: { ...prev.cardSettings[cardId], visible },
      },
    }));
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
  };

  const visibleLeftCards = layout.leftColumn.filter(
    (id) => layout.cardSettings[id]?.visible !== false
  );
  const visibleRightCards = layout.rightColumn.filter(
    (id) => layout.cardSettings[id]?.visible !== false
  );

  return {
    layout,
    visibleLeftCards,
    visibleRightCards,
    isLoaded,
    moveCard,
    reorderInColumn,
    setCardSize,
    setCardWidth,
    setCardVisibility,
    resetLayout,
  };
};
