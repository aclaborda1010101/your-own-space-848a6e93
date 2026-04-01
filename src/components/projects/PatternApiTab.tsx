import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Key, Plus, Copy, Check, ChevronDown, ExternalLink,
  Loader2, Trash2, Globe, Link2, Activity, MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatternApiTabProps {
  projectId: string;
  currentRunId?: string;
}

interface ApiKey {
  id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  monthly_usage: number;
  monthly_limit: number;
  created_at: string;
  last_used_at: string | null;
  run_id: string | null;
  is_global: boolean;
  app_name: string | null;
  project_id: string | null;
}

interface Feedback {
  id: string;
  feedback_type: string;
  sector: string | null;
  geography: string | null;
  outcome: string | null;
  processed: boolean;
  created_at: string;
}

const QUERY_EXAMPLES: Record<string, string> = {
  signals_by_zone: `curl -X POST \\
  'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/pattern-detector-pipeline' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "action": "public_query_v2",
    "api_key": "pk_live_xxx",
    "query_type": "signals_by_zone",
    "filters": {
      "sector": "centros_comerciales",
      "geography": "Madrid",
      "min_credibility": "Beta"
    }
  }'`,
  success_patterns: `curl -X POST ... -d '{ "action": "public_query_v2", "api_key": "...", "query_type": "success_patterns", "filters": { "sector": "centros_comerciales" } }'`,
  risk_signals: `curl -X POST ... -d '{ "action": "public_query_v2", "api_key": "...", "query_type": "risk_signals", "filters": { "sector": "centros_comerciales" } }'`,
  benchmarks: `curl -X POST ... -d '{ "action": "public_query_v2", "api_key": "...", "query_type": "benchmarks", "filters": { "sector": "centros_comerciales" } }'`,
  full_intelligence: `curl -X POST ... -d '{ "action": "public_query_v2", "api_key": "...", "query_type": "full_intelligence", "filters": { "sector": "centros_comerciales" } }'`,
  feedback_ingest: `curl -X POST ... -d '{ "action": "feedback_ingest", "api_key": "...", "feedback_type": "location_validation", "data": { "geography": "Madrid", "outcome": "success", "metrics": { "footfall_increase": 15 } } }'`,
};

export function PatternApiTab({ projectId, currentRunId }: PatternApiTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newAppName, setNewAppName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load keys for this project (global + run-specific)
      const { data: keyData } = await supabase
        .from("pattern_api_keys")
        .select("*")
        .or(`project_id.eq.${projectId},run_id.eq.${currentRunId || "00000000-0000-0000-0000-000000000000"}`)
        .order("created_at", { ascending: false });

      setKeys((keyData || []) as unknown as ApiKey[]);

      // Load recent feedbacks
      const keyIds = (keyData || []).map((k: any) => k.id);
      if (keyIds.length > 0) {
        const { data: fbData } = await supabase
          .from("pattern_feedback")
          .select("id, feedback_type, sector, geography, outcome, processed, created_at")
          .in("api_key_id", keyIds)
          .order("created_at", { ascending: false })
          .limit(20);
        setFeedbacks((fbData || []) as Feedback[]);
      }
    } catch (e) {
      console.error("Error loading API data:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentRunId]);

  useEffect(() => { loadData(); }, [loadData]);

  const createGlobalKey = async () => {
    if (!newKeyName.trim()) { toast.error("Nombre requerido"); return; }
    setCreating(true);
    try {
      const result = await supabase.functions.invoke("pattern-detector-pipeline", {
        body: {
          action: "manage_api_keys",
          subAction: "create_global",
          projectId,
          name: newKeyName,
          appName: newAppName || null,
        },
      });
      if (result.error) throw result.error;
      toast.success("API key global creada");
      setNewKeyName("");
      setNewAppName("");
      loadData();
    } catch (e: any) {
      toast.error(e?.message || "Error creando key");
    } finally {
      setCreating(false);
    }
  };

  const createRunKey = async () => {
    if (!currentRunId) { toast.error("No hay run activo"); return; }
    setCreating(true);
    try {
      const result = await supabase.functions.invoke("pattern-detector-pipeline", {
        body: {
          action: "manage_api_keys",
          subAction: "create",
          runId: currentRunId,
          name: newKeyName || "Run Key",
        },
      });
      if (result.error) throw result.error;
      toast.success("API key de run creada");
      setNewKeyName("");
      loadData();
    } catch (e: any) {
      toast.error(e?.message || "Error creando key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string, runId: string | null) => {
    try {
      const result = await supabase.functions.invoke("pattern-detector-pipeline", {
        body: {
          action: "manage_api_keys",
          subAction: "revoke",
          runId: runId || currentRunId,
          keyId,
        },
      });
      if (result.error) throw result.error;
      toast.success("Key revocada");
      loadData();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const endpointUrl = `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/pattern-detector-pipeline`;

  // Group keys
  const globalKeys = keys.filter(k => k.is_global || !k.run_id);
  const runKeys = keys.filter(k => k.run_id && !k.is_global);

  // Connected apps
  const connectedApps = [...new Set(keys.filter(k => k.app_name).map(k => k.app_name!))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Endpoint URL */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Endpoint URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/50 p-2 rounded border border-border overflow-x-auto">
              {endpointUrl}
            </code>
            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(endpointUrl, "url")}>
              {copiedId === "url" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Keys */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Crear API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="AVA TURING" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">App (opcional)</Label>
              <Input value={newAppName} onChange={e => setNewAppName(e.target.value)} placeholder="ava-turing" className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createGlobalKey} disabled={creating} className="text-xs">
              {creating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
              Key Global (proyecto)
            </Button>
            <Button size="sm" variant="outline" onClick={createRunKey} disabled={creating || !currentRunId} className="text-xs">
              <Link2 className="w-3 h-3 mr-1" /> Key de Run
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keys Table */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> API Keys ({keys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No hay API keys creadas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs">Key</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Uso</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map(key => (
                  <TableRow key={key.id}>
                    <TableCell className="text-xs">
                      <div>{key.name}</div>
                      {key.app_name && <span className="text-muted-foreground">{key.app_name}</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <code className="text-[10px] bg-muted/50 px-1 rounded">{key.api_key.slice(0, 16)}...</code>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyToClipboard(key.api_key, key.id)}>
                          {copiedId === key.id ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.is_global || !key.run_id ? "default" : "secondary"} className="text-[10px]">
                        {key.is_global || !key.run_id ? "Global" : "Run"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{key.monthly_usage}/{key.monthly_limit}</TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? "default" : "destructive"} className="text-[10px]">
                        {key.is_active ? "Activa" : "Revocada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.is_active && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => revokeKey(key.id, key.run_id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Connected Apps */}
      {connectedApps.length > 0 && (
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" /> Apps Conectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {connectedApps.map(app => (
                <Badge key={app} variant="outline" className="text-xs gap-1">
                  <Activity className="w-3 h-3" /> {app}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Received */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Feedback Recibido ({feedbacks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sin feedback de apps externas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Sector</TableHead>
                  <TableHead className="text-xs">Outcome</TableHead>
                  <TableHead className="text-xs">Procesado</TableHead>
                  <TableHead className="text-xs">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbacks.map(fb => (
                  <TableRow key={fb.id}>
                    <TableCell className="text-xs">{fb.feedback_type}</TableCell>
                    <TableCell className="text-xs">{fb.sector || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={fb.outcome === "success" ? "default" : fb.outcome === "failure" ? "destructive" : "secondary"} className="text-[10px]">
                        {fb.outcome || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={fb.processed ? "default" : "outline"} className="text-[10px]">
                        {fb.processed ? "Sí" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(fb.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
        <Card className="border-border bg-card/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 transition-transform ${docsOpen ? "rotate-180" : ""}`} />
                Documentación API (query_types)
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {Object.entries(QUERY_EXAMPLES).map(([type, example]) => (
                <div key={type} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{type}</Badge>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyToClipboard(example, `doc-${type}`)}>
                      {copiedId === `doc-${type}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                    </Button>
                  </div>
                  <pre className="text-[10px] bg-muted/30 p-2 rounded border border-border overflow-x-auto whitespace-pre-wrap">
                    {example}
                  </pre>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
