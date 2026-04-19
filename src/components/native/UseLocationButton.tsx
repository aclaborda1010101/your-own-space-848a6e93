import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2 } from "lucide-react";
import { useGeolocation, type GeolocationSource } from "@/hooks/useGeolocation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UseLocationButtonProps {
  /** Mensaje contextual que se guarda junto a la captura */
  context?: string;
  /** Origen lógico de la captura */
  source?: GeolocationSource;
  /** Callback con la ubicación obtenida */
  onLocation?: (loc: { lat: number; lng: number; accuracy?: number | null }) => void;
  /** Si debe persistir en `user_location_history` */
  persist?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
  label?: string;
}

/**
 * Botón compacto para obtener (y opcionalmente persistir) la ubicación actual.
 * Pensado para insertar en formularios de tarea/evento o en el chat de JARVIS.
 */
export function UseLocationButton({
  context,
  source = "manual",
  onLocation,
  persist = true,
  variant = "outline",
  size = "sm",
  className,
  label = "Usar mi ubicación",
}: UseLocationButtonProps) {
  const geo = useGeolocation();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      if (geo.permission === "prompt" || geo.permission === "unknown") {
        const granted = await geo.requestPermission();
        if (!granted && geo.permission === "denied") {
          toast.error("Permiso de ubicación denegado");
          return;
        }
      }
      const loc = await geo.getCurrentPosition({ persist, source, context });
      if (loc) {
        onLocation?.({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy });
        toast.success("Ubicación capturada", {
          description: `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy ?? 0)} m)`,
        });
      } else {
        toast.error("No se pudo obtener la ubicación", { description: geo.error ?? undefined });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={handleClick} disabled={busy} className={cn(className)}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
      {label}
      {geo.lastLocation && !busy && (
        <Badge variant="secondary" className="ml-2 text-[10px]">
          ±{Math.round(geo.lastLocation.accuracy ?? 0)} m
        </Badge>
      )}
    </Button>
  );
}

export default UseLocationButton;
