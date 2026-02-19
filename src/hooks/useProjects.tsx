import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface BusinessProject {
  id: string;
  name: string;
  status: string;
  origin: string | null;
  origin_source_id: string | null;
  detected_at: string;
  primary_contact_id: string | null;
  primary_contact_name?: string;
  company: string | null;
  estimated_value: number | null;
  close_probability: string;
  need_summary: string | null;
  need_why: string | null;
  need_deadline: string | null;
  need_budget: string | null;
  need_decision_maker: string | null;
  need_source_url: string | null;
  analysis: any;
  closed_at: string | null;
  close_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectContact {
  id: string;
  project_id: string;
  contact_id: string;
  contact_name?: string;
  role: string;
  notes: string | null;
  created_at: string;
}

export interface ProjectTimelineEntry {
  id: string;
  project_id: string;
  event_date: string;
  channel: string;
  title: string;
  description: string | null;
  source_id: string | null;
  contact_id: string | null;
  contact_name?: string;
  auto_detected: boolean;
  created_at: string;
}

export type ProjectStatus = "nuevo" | "en_conversacion" | "propuesta_enviada" | "negociacion" | "ganado" | "perdido" | "pausado" | "descartado";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "nuevo", label: "Nuevo", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { value: "en_conversacion", label: "En conversación", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  { value: "propuesta_enviada", label: "Propuesta enviada", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { value: "negociacion", label: "Negociación", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  { value: "ganado", label: "Ganado", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  { value: "perdido", label: "Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  { value: "pausado", label: "Pausado", color: "bg-muted text-muted-foreground border-border" },
  { value: "descartado", label: "Descartado", color: "bg-muted text-muted-foreground border-border" },
];

export const PROJECT_ROLES = [
  { value: "cliente", label: "Cliente" },
  { value: "decisor", label: "Decisor" },
  { value: "influencer", label: "Influencer" },
  { value: "colaborador_interno", label: "Colaborador interno" },
  { value: "socio", label: "Socio" },
  { value: "competidor", label: "Competidor" },
];

export const useProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<BusinessProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_projects")
        .select("*, people_contacts!business_projects_primary_contact_id_fkey(name)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setProjects(
        (data || []).map((p: any) => ({
          ...p,
          primary_contact_name: p.people_contacts?.name || null,
        }))
      );
    } catch (e: any) {
      console.error("Error fetching projects:", e);
      toast.error("Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  const createProject = async (data: {
    name: string;
    company?: string;
    estimated_value?: number;
    primary_contact_id?: string;
    need_summary?: string;
    origin?: string;
    status?: string;
  }) => {
    if (!user) return null;
    try {
      const { data: row, error } = await supabase
        .from("business_projects")
        .insert({
          user_id: user.id,
          name: data.name,
          company: data.company || null,
          estimated_value: data.estimated_value || null,
          primary_contact_id: data.primary_contact_id || null,
          need_summary: data.need_summary || null,
          origin: data.origin || "manual",
          status: data.status || "nuevo",
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Proyecto creado");
      await fetchProjects();
      return row;
    } catch (e: any) {
      console.error("Error creating project:", e);
      toast.error("Error al crear proyecto");
      return null;
    }
  };

  const updateProject = async (id: string, updates: Partial<BusinessProject>) => {
    try {
      const { error } = await supabase
        .from("business_projects")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Proyecto actualizado");
      await fetchProjects();
    } catch (e: any) {
      console.error("Error updating project:", e);
      toast.error("Error al actualizar proyecto");
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from("business_projects").delete().eq("id", id);
      if (error) throw error;
      toast.success("Proyecto eliminado");
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error("Error deleting project:", e);
      toast.error("Error al eliminar proyecto");
    }
  };

  // --- Contacts ---
  const fetchProjectContacts = async (projectId: string): Promise<ProjectContact[]> => {
    const { data, error } = await supabase
      .from("business_project_contacts")
      .select("*, people_contacts!business_project_contacts_contact_id_fkey(name)")
      .eq("project_id", projectId);
    if (error) { console.error(error); return []; }
    return (data || []).map((c: any) => ({
      ...c,
      contact_name: c.people_contacts?.name || null,
    }));
  };

  const addProjectContact = async (projectId: string, contactId: string, role: string) => {
    const { error } = await supabase
      .from("business_project_contacts")
      .insert({ project_id: projectId, contact_id: contactId, role });
    if (error) {
      if (error.code === "23505") toast.error("Contacto ya vinculado");
      else toast.error("Error al vincular contacto");
      return;
    }
    toast.success("Contacto vinculado");
  };

  const removeProjectContact = async (id: string) => {
    const { error } = await supabase.from("business_project_contacts").delete().eq("id", id);
    if (error) { toast.error("Error"); return; }
    toast.success("Contacto desvinculado");
  };

  // --- Timeline ---
  const fetchTimeline = async (projectId: string): Promise<ProjectTimelineEntry[]> => {
    const { data, error } = await supabase
      .from("business_project_timeline")
      .select("*, people_contacts!business_project_timeline_contact_id_fkey(name)")
      .eq("project_id", projectId)
      .order("event_date", { ascending: false });
    if (error) { console.error(error); return []; }
    return (data || []).map((t: any) => ({
      ...t,
      contact_name: t.people_contacts?.name || null,
    }));
  };

  const addTimelineEntry = async (entry: {
    project_id: string;
    event_date: string;
    channel: string;
    title: string;
    description?: string;
    contact_id?: string;
  }) => {
    const { error } = await supabase
      .from("business_project_timeline")
      .insert({ ...entry, auto_detected: false });
    if (error) { toast.error("Error al añadir evento"); return; }
    toast.success("Evento añadido al timeline");
  };

  // --- Computed ---
  const activeProjects = useMemo(
    () => projects.filter((p) => !["ganado", "perdido", "pausado", "descartado"].includes(p.status)),
    [projects]
  );

  const closedProjects = useMemo(
    () => projects.filter((p) => ["ganado", "perdido"].includes(p.status)),
    [projects]
  );

  const pausedProjects = useMemo(
    () => projects.filter((p) => p.status === "pausado"),
    [projects]
  );

  const pipelineValue = useMemo(() => {
    const total = activeProjects.reduce((sum, p) => sum + (p.estimated_value || 0), 0);
    const weighted = activeProjects.reduce((sum, p) => {
      const prob = p.close_probability === "alta" ? 0.8 : p.close_probability === "media" ? 0.5 : 0.2;
      return sum + (p.estimated_value || 0) * prob;
    }, 0);
    return { total, weighted };
  }, [activeProjects]);

  return {
    projects,
    activeProjects,
    closedProjects,
    pausedProjects,
    pipelineValue,
    loading,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    fetchProjectContacts,
    addProjectContact,
    removeProjectContact,
    fetchTimeline,
    addTimelineEntry,
  };
};
