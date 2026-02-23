import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface RagProject {
  id: string;
  user_id: string;
  project_id: string | null;
  domain_description: string;
  moral_mode: string;
  build_profile: string | null;
  status: string;
  domain_map: Record<string, unknown> | null;
  domain_confirmed: boolean;
  domain_adjustments: Record<string, unknown> | null;
  current_phase: number;
  total_sources: number;
  total_chunks: number;
  total_variables: number;
  coverage_pct: number;
  quality_verdict: string | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
  // Extended fields from status
  research_runs?: Array<Record<string, unknown>>;
  quality_check?: Record<string, unknown> | null;
  contradictions_count?: number;
  gaps_count?: number;
}

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];
const POLL_INTERVAL = 5000;

export function useRagArchitect() {
  const { user } = useAuth();
  const [rags, setRags] = useState<RagProject[]>([]);
  const [selectedRag, setSelectedRag] = useState<RagProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const invoke = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      const { data, error } = await supabase.functions.invoke("rag-architect", {
        body: { action, ...body },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    []
  );

  const fetchRags = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await invoke("list");
      setRags(data.rags || []);
    } catch (err) {
      console.error("fetchRags error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, invoke]);

  const createRag = useCallback(
    async (domainDescription: string, moralMode: string = "total", projectId?: string) => {
      setCreating(true);
      try {
        const data = await invoke("create", { domainDescription, moralMode, projectId });
        toast.success(`Análisis de dominio iniciado en modo ${moralMode.toUpperCase()}`);
        await fetchRags();
        // Start polling the new RAG
        if (data.ragId) {
          await refreshStatus(data.ragId);
        }
        return data;
      } catch (err) {
        toast.error("Error al crear RAG: " + (err instanceof Error ? err.message : "Error desconocido"));
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [invoke, fetchRags]
  );

  const confirmDomain = useCallback(
    async (ragId: string, adjustments?: Record<string, unknown>) => {
      setConfirming(true);
      try {
        const data = await invoke("confirm", { ragId, adjustments });
        toast.success("Construcción del RAG iniciada");
        await refreshStatus(ragId);
        return data;
      } catch (err) {
        toast.error("Error al confirmar: " + (err instanceof Error ? err.message : "Error desconocido"));
        throw err;
      } finally {
        setConfirming(false);
      }
    },
    [invoke]
  );

  const refreshStatus = useCallback(
    async (ragId: string) => {
      try {
        const data = await invoke("status", { ragId });
        setSelectedRag(data as RagProject);
        // Update in list too
        setRags((prev) =>
          prev.map((r) => (r.id === ragId ? { ...r, ...data } : r))
        );
        return data as RagProject;
      } catch (err) {
        console.error("refreshStatus error:", err);
        return null;
      }
    },
    [invoke]
  );

  // Polling
  useEffect(() => {
    if (selectedRag && !TERMINAL_STATUSES.includes(selectedRag.status)) {
      pollingRef.current = setInterval(() => {
        refreshStatus(selectedRag.id);
      }, POLL_INTERVAL);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedRag?.id, selectedRag?.status, refreshStatus]);

  // Initial fetch
  useEffect(() => {
    fetchRags();
  }, [fetchRags]);

  const queryRag = useCallback(
    async (ragId: string, question: string) => {
      const data = await invoke("query", { ragId, question });
      return data;
    },
    [invoke]
  );

  const exportRag = useCallback(
    async (ragId: string, format: string = "document_md") => {
      const data = await invoke("export", { ragId, format });
      return data;
    },
    [invoke]
  );

  const rebuildRag = useCallback(
    async (ragId: string) => {
      try {
        const data = await invoke("rebuild", { ragId });
        toast.success("Regeneración del RAG iniciada");
        await refreshStatus(ragId);
        return data;
      } catch (err) {
        toast.error("Error al regenerar: " + (err instanceof Error ? err.message : "Error desconocido"));
        throw err;
      }
    },
    [invoke, refreshStatus]
  );

  const resumeRag = useCallback(
    async (ragId: string) => {
      try {
        const data = await invoke("resume", { ragId });
        toast.success("Reanudación de ingesta iniciada");
        await refreshStatus(ragId);
        return data;
      } catch (err) {
        toast.error("Error al reanudar: " + (err instanceof Error ? err.message : "Error desconocido"));
        throw err;
      }
    },
    [invoke, refreshStatus]
  );

  const regenerateEnrichment = useCallback(
    async (ragId: string, step: string = "knowledge_graph") => {
      try {
        const data = await invoke("regenerate-enrichment", { ragId, step });
        toast.success("Regeneración de enriquecimiento iniciada");
        await refreshStatus(ragId);
        return data;
      } catch (err) {
        toast.error("Error al regenerar enriquecimiento: " + (err instanceof Error ? err.message : "Error desconocido"));
        throw err;
      }
    },
    [invoke, refreshStatus]
  );

  return {
    rags,
    selectedRag,
    setSelectedRag,
    loading,
    creating,
    confirming,
    fetchRags,
    createRag,
    confirmDomain,
    refreshStatus,
    queryRag,
    exportRag,
    rebuildRag,
    resumeRag,
    regenerateEnrichment,
  };
}
