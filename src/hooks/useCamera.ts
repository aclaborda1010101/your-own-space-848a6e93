import { useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource, type Photo } from "@capacitor/camera";

export interface CapturedPhoto {
  /** data: URL when web, or filesystem URL on native */
  webPath: string;
  /** base64 string without data: prefix when available */
  base64?: string;
  format: string;
}

export interface UseCameraAPI {
  isNative: boolean;
  busy: boolean;
  error: string | null;
  permission: "granted" | "denied" | "prompt" | "unknown";
  requestPermission: () => Promise<boolean>;
  takePhoto: (opts?: { quality?: number; allowEditing?: boolean }) => Promise<CapturedPhoto | null>;
  pickFromGallery: (opts?: { quality?: number }) => Promise<CapturedPhoto | null>;
  pickMultiple: (opts?: { limit?: number; quality?: number }) => Promise<CapturedPhoto[]>;
}

/**
 * Native-aware camera hook using @capacitor/camera on iOS/Android,
 * with a graceful <input type="file"> fallback on web.
 */
export function useCamera(): UseCameraAPI {
  const isNative = Capacitor.isNativePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<UseCameraAPI["permission"]>("unknown");

  const mapPerm = (p: string): UseCameraAPI["permission"] => {
    if (p === "granted") return "granted";
    if (p === "denied") return "denied";
    if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
    return "unknown";
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return true;
    try {
      const status = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
      const cam = mapPerm(status.camera);
      setPermission(cam);
      return cam === "granted";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [isNative]);

  const photoToCaptured = (p: Photo): CapturedPhoto => ({
    webPath: p.webPath ?? `data:image/${p.format};base64,${p.base64String ?? ""}`,
    base64: p.base64String,
    format: p.format,
  });

  const webPickerSingle = (multi = false): Promise<CapturedPhoto[]> =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (multi) input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files ?? []);
        const results: CapturedPhoto[] = [];
        for (const f of files) {
          const url = URL.createObjectURL(f);
          results.push({ webPath: url, format: f.type.split("/")[1] ?? "jpeg" });
        }
        resolve(results);
      };
      input.oncancel = () => resolve([]);
      input.click();
    });

  const takePhoto = useCallback(
    async (opts: { quality?: number; allowEditing?: boolean } = {}): Promise<CapturedPhoto | null> => {
      setError(null);
      setBusy(true);
      try {
        if (!isNative) {
          const arr = await webPickerSingle(false);
          return arr[0] ?? null;
        }
        const ok = await requestPermission();
        if (!ok) {
          setError("Permiso de cámara denegado");
          return null;
        }
        const photo = await Camera.getPhoto({
          quality: opts.quality ?? 80,
          allowEditing: opts.allowEditing ?? false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          saveToGallery: false,
        });
        return photoToCaptured(photo);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [isNative, requestPermission],
  );

  const pickFromGallery = useCallback(
    async (opts: { quality?: number } = {}): Promise<CapturedPhoto | null> => {
      setError(null);
      setBusy(true);
      try {
        if (!isNative) {
          const arr = await webPickerSingle(false);
          return arr[0] ?? null;
        }
        const photo = await Camera.getPhoto({
          quality: opts.quality ?? 80,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
        });
        return photoToCaptured(photo);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [isNative],
  );

  const pickMultiple = useCallback(
    async (opts: { limit?: number; quality?: number } = {}): Promise<CapturedPhoto[]> => {
      setError(null);
      setBusy(true);
      try {
        if (!isNative) {
          return await webPickerSingle(true);
        }
        const result = await Camera.pickImages({
          limit: opts.limit ?? 5,
          quality: opts.quality ?? 80,
        });
        return (result.photos ?? []).map((p) => ({
          webPath: p.webPath ?? "",
          format: p.format,
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setBusy(false);
      }
    },
    [isNative],
  );

  return {
    isNative,
    busy,
    error,
    permission,
    requestPermission,
    takePhoto,
    pickFromGallery,
    pickMultiple,
  };
}

export default useCamera;
