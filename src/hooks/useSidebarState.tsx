import { useState, useCallback } from "react";

export const useSidebarState = () => {
  const [isOpen, setIsOpen] = useState(false);

  const safeGet = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeSet = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors (private mode / blocked storage)
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = safeGet("sidebar-collapsed");
    return saved === "true";
  });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      safeSet("sidebar-collapsed", String(newValue));
      return newValue;
    });
  }, []);

  return {
    isOpen,
    isCollapsed,
    open,
    close,
    toggleCollapse,
  };
};