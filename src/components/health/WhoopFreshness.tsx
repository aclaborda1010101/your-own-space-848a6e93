import { useEffect, useMemo, useState } from "react";
import { useJarvisWhoopData } from "@/hooks/useJarvisWhoopData";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Indicador "Actualizado hace X" + botón refresh manual.
 * Llama a whoop-sync action sync_all_users (filtrado por user via token).
 */
export function WhoopFreshness() {
  const { user } = useAuth();
  const { data, refetch } = useJarvisWhoopData();
  const [now, setNow] = useState(Date.now());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const label = useMemo(() => {
    if (!data?.synced_at) return "Sin sincronizar";
    const ageMs = now - new Date(data.synced_at).getTime();
    const min = Math.floor(ageMs / 60_000);
    if (min < 1) return "Actualizado ahora";
    if (min < 60) return `Actualizado hace ${min} min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `Actualizado hace ${hr} h`;
    return `Actualizado hace ${Math.floor(hr / 24)} d`;
  }, [data?.synced_at, now]);

  const sync = async () => {
    if (!user?.id) return;
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("whoop-sync", {
        body: { action: "sync_all_users" },
      });
      if (error) throw error;
      await refetch();
      toast.success("WHOOP sincronizado");
    } catch (e: any) {
      toast.error("No se pudo sincronizar: " + (e?.message || "error"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono">{label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={sync}
        disabled={syncing}
        aria-label="Refrescar WHOOP"
      >
        {syncing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
      </Button>
    </div>
  );
}
