import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff, QrCode, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ConnectionState = "open" | "close" | "connecting" | "unknown";

const INSTANCE_NAME = "jarvis-whatsapp";

export const WhatsAppConnectionCard = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ConnectionState>("unknown");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ownedByOther, setOwnedByOther] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const callManage = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke("evolution-manage-v2", {
      body: { action, instanceName: INSTANCE_NAME },
    });
    if (error) throw error;
    return data;
  }, []);

  const ensureWebhook = useCallback(async () => {
    try {
      await callManage("set_webhook");
      console.log("Webhook reconfigured successfully");
    } catch (err) {
      console.warn("set_webhook failed:", err);
    }
  }, [callManage]);

  const checkOwnership = useCallback(async () => {
    if (!user) return false;
    const { data } = await (supabase
      .from("user_integrations" as any)
      .select("user_id")
      .eq("provider", "evolution_whatsapp")
      .maybeSingle() as any);
    if (data && data.user_id !== user.id) {
      setOwnedByOther(true);
      return false;
    }
    setOwnedByOther(false);
    return true;
  }, [user]);

  const saveOwnership = useCallback(async () => {
    if (!user) return;
    await supabase.from("user_integrations").upsert({
      user_id: user.id,
      provider: "evolution_whatsapp",
      access_token: "connected",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,provider" });
  }, [user]);

  const checkStatus = useCallback(async () => {
    try {
      const data = await callManage("status");
      const s = data?.instance?.state || data?.state || "unknown";
      setState((prev) => {
        if (prev !== "open" && s === "open") {
          ensureWebhook();
        }
        return s as ConnectionState;
      });
      if (s === "open") {
        setQrBase64(null);
        stopPolling();
        await checkOwnership();
      }
      return s;
    } catch {
      setState("unknown");
      return "unknown";
    } finally {
      setChecking(false);
    }
  }, [callManage, ensureWebhook, checkOwnership]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(checkStatus, 4000);
  };

  useEffect(() => {
    checkStatus();
    return () => stopPolling();
  }, [checkStatus]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Try to create instance (may already exist)
      await callManage("create_instance");

      // Get QR
      const qrData = await callManage("get_qr");
      const base64 = qrData?.base64 || qrData?.qrcode?.base64 || null;

      if (base64) {
        setQrBase64(base64);
        startPolling();
      } else if (qrData?.instance?.state === "open") {
        setState("open");
        toast.success("WhatsApp ya está conectado");
      } else {
        toast.error("No se pudo obtener el QR. Intenta de nuevo.");
      }
    } catch (err: any) {
      console.error("Connect error:", err);
      toast.error("Error al conectar: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await callManage("disconnect");
      setState("close");
      toast.success("WhatsApp desconectado");
    } catch (err: any) {
      toast.error("Error al desconectar");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshQr = async () => {
    setLoading(true);
    try {
      const qrData = await callManage("get_qr");
      const base64 = qrData?.base64 || qrData?.qrcode?.base64 || null;
      if (base64) {
        setQrBase64(base64);
        startPolling();
      }
    } catch {
      toast.error("Error al refrescar QR");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Verificando conexión...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state === "open" ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span className="text-sm font-medium">Estado:</span>
          <Badge variant={state === "open" ? "default" : "destructive"}>
            {state === "open" ? "Conectado" : state === "connecting" ? "Conectando..." : "Desconectado"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={checkStatus} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* QR Code */}
      {qrBase64 && state !== "open" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Escanea este QR con WhatsApp en tu móvil (Ajustes → Dispositivos vinculados → Vincular dispositivo)
          </p>
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img
              src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt="WhatsApp QR Code"
              className="w-56 h-56 sm:w-64 sm:h-64"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleRefreshQr} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
            Refrescar QR
          </Button>
        </div>
      )}

      {/* Actions */}
      {state !== "open" && !qrBase64 && (
        <Button onClick={handleConnect} disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
          Conectar WhatsApp
        </Button>
      )}

      {state === "open" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Tu WhatsApp personal está sincronizado. Los mensajes se reciben automáticamente en el CRM.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Desconectar
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { setLoading(true); await ensureWebhook(); toast.success("Webhook reconfigurado"); setLoading(false); }} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reconfigurar webhook
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
