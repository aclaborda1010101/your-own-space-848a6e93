import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectContext {
  id: string;
  project_id: string;
  source_url: string | null;
  company_name: string | null;
  company_description: string | null;
  sector_detected: string | null;
  geography_detected: string | null;
  products_services: string[];
  tech_stack_detected: string[];
  social_media: Record<string, string | null>;
  competitors: Array<{ name: string; description: string }>;
  reviews_summary: Record<string, any>;
  sector_trends: string[];
  news_mentions: Array<{ title: string; date: string; summary: string }>;
  public_data: Record<string, any>;
  confidence_score: number | null;
}

export function useAutoResearch() {
  const [researching, setResearching] = useState(false);
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runResearch = useCallback(async (projectId: string, url: string) => {
    setResearching(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("auto-research", {
        body: { project_id: projectId, url },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setContext(data.context as ProjectContext);
      toast.success("Research completado");
      return data.context as ProjectContext;
    } catch (e: any) {
      const msg = e?.message || "Error en auto-research";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setResearching(false);
    }
  }, []);

  const loadContext = useCallback(async (projectId: string) => {
    const { data } = await supabase
      .from("project_context")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setContext(data as unknown as ProjectContext);
    return data as unknown as ProjectContext | null;
  }, []);

  const clearContext = useCallback(() => {
    setContext(null);
    setError(null);
  }, []);

  return { researching, context, error, runResearch, loadContext, clearContext };
}
