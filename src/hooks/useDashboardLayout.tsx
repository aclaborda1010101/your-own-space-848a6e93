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

interface DashboardLayout {
  leftColumn: DashboardCardId[];
  rightColumn: DashboardCardId[];
}

const DEFAULT_LAYOUT: DashboardLayout = {
  leftColumn: ["check-in", "daily-plan", "publications"],
  rightColumn: ["agenda", "challenge", "coach", "priorities", "alerts"],
};

const STORAGE_KEY = "dashboard-layout";

export const useDashboardLayout = () => {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate structure
        if (parsed.leftColumn && parsed.rightColumn) {
          setLayout(parsed);
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

      // Remove from source
      newLayout[fromKey] = prev[fromKey].filter((id) => id !== cardId);

      // Add to destination
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

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
  };

  return {
    layout,
    isLoaded,
    moveCard,
    reorderInColumn,
    resetLayout,
  };
};
