export function initSafeStorage() {
  if (typeof window === "undefined") return;

  const patchStorage = (getStorage: () => Storage) => {
    let storage: Storage | null = null;

    try {
      storage = getStorage();
    } catch {
      return;
    }

    if (!storage) return;

    const testKey = "__jarvis_storage_test__";

    try {
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return; // Storage works
    } catch {
      // Storage exists but throws (common in private mode / blocked storage)
    }

    try {
      const origGetItem = storage.getItem.bind(storage);
      const origSetItem = storage.setItem.bind(storage);
      const origRemoveItem = storage.removeItem.bind(storage);
      const origClear = storage.clear.bind(storage);

      const safeGetItem = (key: string) => {
        try {
          return origGetItem(key);
        } catch {
          return null;
        }
      };

      const safeSetItem = (key: string, value: string) => {
        try {
          origSetItem(key, value);
        } catch {
          // ignore
        }
      };

      const safeRemoveItem = (key: string) => {
        try {
          origRemoveItem(key);
        } catch {
          // ignore
        }
      };

      const safeClear = () => {
        try {
          origClear();
        } catch {
          // ignore
        }
      };

      // Patch instance methods (best-effort; some browsers lock these down)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = storage;
      s.getItem = safeGetItem;
      s.setItem = safeSetItem;
      s.removeItem = safeRemoveItem;
      s.clear = safeClear;
    } catch {
      // ignore
    }
  };

  patchStorage(() => window.localStorage);
  patchStorage(() => window.sessionStorage);
}
