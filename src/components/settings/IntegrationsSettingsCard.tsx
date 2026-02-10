import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, Copy, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PlatformLink {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name: string | null;
  created_at: string;
}

export const IntegrationsSettingsCard = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<PlatformLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState<{ code: string; platform: string } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchLinks();
  }, [user]);

  const fetchLinks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("platform_users")
      .select("*")
      .eq("user_id", user.id);
    setLinks((data as PlatformLink[]) || []);
    setLoading(false);
  };

  const generateCode = async (platform: string) => {
    if (!user) return;
    setGenerating(platform);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from("linking_codes").insert({
        user_id: user.id,
        code,
        platform,
      });
      if (error) throw error;
      setLinkingCode({ code, platform });
      toast.success("Código generado");
    } catch {
      toast.error("Error generando código");
    } finally {
      setGenerating(null);
    }
  };

  const copyCode = () => {
    if (linkingCode) {
      navigator.clipboard.writeText(linkingCode.code);
      toast.success("Código copiado");
    }
  };

  const unlinkPlatform = async (linkId: string, platform: string) => {
    const { error } = await supabase.from("platform_users").delete().eq("id", linkId);
    if (error) {
      toast.error("Error desvinculando");
      return;
    }
    setLinks(links.filter(l => l.id !== linkId));
    toast.success(`${platform} desvinculado`);
  };

  const telegramLink = links.find(l => l.platform === "telegram");
  const whatsappLink = links.find(l => l.platform === "whatsapp");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Integraciones
        </CardTitle>
        <CardDescription>
          Conecta JARVIS a Telegram y WhatsApp para hablar desde cualquier plataforma
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Telegram */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-blue-500" />
            <div>
              <p className="font-medium text-foreground">Telegram</p>
              {telegramLink ? (
                <p className="text-xs text-muted-foreground">
                  Vinculado como {telegramLink.display_name || telegramLink.platform_user_id}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No vinculado</p>
              )}
            </div>
          </div>
          {telegramLink ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Conectado</Badge>
              <Button variant="ghost" size="sm" onClick={() => unlinkPlatform(telegramLink.id, "Telegram")}>
                <Unlink className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateCode("telegram")}
              disabled={generating === "telegram"}
            >
              {generating === "telegram" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
            </Button>
          )}
        </div>

        {/* WhatsApp */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-foreground">WhatsApp</p>
              {whatsappLink ? (
                <p className="text-xs text-muted-foreground">
                  Vinculado: {whatsappLink.display_name || whatsappLink.platform_user_id}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No vinculado</p>
              )}
            </div>
          </div>
          {whatsappLink ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Conectado</Badge>
              <Button variant="ghost" size="sm" onClick={() => unlinkPlatform(whatsappLink.id, "WhatsApp")}>
                <Unlink className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateCode("whatsapp")}
              disabled={generating === "whatsapp"}
            >
              {generating === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
            </Button>
          )}
        </div>

        {/* Linking code display */}
        {linkingCode && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
            <p className="text-sm font-medium text-foreground">
              Código de vinculación para {linkingCode.platform === "telegram" ? "Telegram" : "WhatsApp"}:
            </p>
            <div className="flex items-center gap-2">
              <code className="text-2xl font-mono font-bold tracking-widest text-primary bg-background px-4 py-2 rounded border">
                {linkingCode.code}
              </code>
              <Button variant="ghost" size="sm" onClick={copyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {linkingCode.platform === "telegram"
                ? "Envía /vincular " + linkingCode.code + " al bot de Telegram"
                : "Envía este código al número de WhatsApp de JARVIS"}
            </p>
            <p className="text-xs text-muted-foreground">Expira en 10 minutos</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
