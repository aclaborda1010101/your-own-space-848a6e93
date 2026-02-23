import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Key, Copy, Code, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RagProject } from "@/hooks/useRagArchitect";

interface ApiKey {
  id: string;
  api_key: string;
  client_name: string | null;
  is_active: boolean | null;
  queries_used_this_month: number | null;
  monthly_query_limit: number | null;
  created_at: string | null;
  expires_at: string | null;
}

interface RagApiTabProps {
  rag: RagProject;
}

export function RagApiTab({ rag }: RagApiTabProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  const embedUrl = `${window.location.origin}/rag/${rag.id}/embed`;

  const fetchApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const { data, error } = await supabase
        .from("rag_api_keys")
        .select("*")
        .eq("rag_id", rag.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setApiKeys((data as unknown as ApiKey[]) || []);
    } catch {
      console.error("Error fetching API keys");
    } finally {
      setLoadingKeys(false);
    }
  }, [rag.id]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Escribe un nombre para la API key");
      return;
    }
    setCreatingKey(true);
    try {
      const key = `rag_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`;
      const { error } = await supabase.from("rag_api_keys").insert({
        rag_id: rag.id,
        api_key: key,
        client_name: newKeyName.trim(),
        is_active: true,
        queries_used_this_month: 0,
        monthly_query_limit: 1000,
      });
      if (error) throw error;
      toast.success("API key creada");
      setNewKeyName("");
      await fetchApiKeys();
    } catch {
      toast.error("Error al crear API key");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from("rag_api_keys")
        .update({ is_active: false })
        .eq("id", keyId);
      if (error) throw error;
      toast.success("API key revocada");
      await fetchApiKeys();
    } catch {
      toast.error("Error al revocar");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const iframeSnippet = `<iframe src="${embedUrl}?token=TU_API_KEY" width="100%" height="600" frameborder="0"></iframe>`;

  return (
    <div className="space-y-4">
      {/* Embed URL */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Chat Embebible</span>
          </div>
          <div className="flex gap-2">
            <Input value={embedUrl} readOnly className="text-xs font-mono" />
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(embedUrl, "URL")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="relative">
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto font-mono">{iframeSnippet}</pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-1 right-1"
              onClick={() => copyToClipboard(iframeSnippet, "Snippet")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Key */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">API Keys</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nombre de la key (ej: Web principal)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
            />
            <Button size="sm" onClick={handleCreateKey} disabled={creatingKey}>
              {creatingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keys List */}
      {loadingKeys ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No hay API keys creadas</p>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((k) => (
            <Card key={k.id} className={!k.is_active ? "opacity-50" : ""}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{k.client_name || "Sin nombre"}</span>
                    <Badge variant={k.is_active ? "default" : "secondary"} className="text-[10px]">
                      {k.is_active ? "Activa" : "Revocada"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-[10px] text-muted-foreground font-mono truncate">
                      {k.api_key.slice(0, 12)}...{k.api_key.slice(-6)}
                    </code>
                    <span className="text-[10px] text-muted-foreground">
                      {k.queries_used_this_month || 0}/{k.monthly_query_limit || 1000} uso
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(k.api_key, "API Key")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  {k.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => handleRevokeKey(k.id)} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
