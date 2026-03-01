import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ShareRole = "viewer" | "editor";
export type ResourceType = "business_project" | "task" | "rag_project" | "pattern_detector_run" | "people_contact" | "calendar" | "check_in" | "data_source";

export interface ResourceShare {
  id: string;
  owner_id: string;
  shared_with_id: string;
  resource_type: ResourceType;
  resource_id: string | null;
  role: ShareRole;
  created_at: string;
  shared_with_email?: string;
  shared_with_name?: string;
}

export const useSharing = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const findUserByEmail = useCallback(async (email: string) => {
    const { data, error } = await supabase.rpc("find_user_by_email", { p_email: email });
    if (error || !data || (data as any[]).length === 0) return null;
    const row = (data as any[])[0];
    return { id: row.id as string, email: row.email as string, display_name: row.display_name as string };
  }, []);

  const getSharesForResource = useCallback(async (resourceType: ResourceType, resourceId?: string) => {
    if (!user) return [];
    let query = supabase
      .from("resource_shares")
      .select("*")
      .eq("owner_id", user.id)
      .eq("resource_type", resourceType);

    if (resourceId) {
      query = query.eq("resource_id", resourceId);
    } else {
      query = query.is("resource_id", null);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return (data || []) as ResourceShare[];
  }, [user]);

  const getSharedWithMe = useCallback(async (resourceType?: ResourceType) => {
    if (!user) return [];
    let query = supabase
      .from("resource_shares")
      .select("*")
      .eq("shared_with_id", user.id);

    if (resourceType) {
      query = query.eq("resource_type", resourceType);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return (data || []) as ResourceShare[];
  }, [user]);

  const shareResource = useCallback(async (
    email: string,
    resourceType: ResourceType,
    role: ShareRole = "viewer",
    resourceId?: string
  ) => {
    if (!user) return false;
    setLoading(true);
    try {
      const target = await findUserByEmail(email);
      if (!target) {
        toast.error("No se encontró un usuario con ese email");
        return false;
      }
      if (target.id === user.id) {
        toast.error("No puedes compartir contigo mismo");
        return false;
      }

      const { error } = await supabase.from("resource_shares").insert({
        owner_id: user.id,
        shared_with_id: target.id,
        resource_type: resourceType,
        resource_id: resourceId || null,
        role,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya compartido con este usuario");
        } else {
          throw error;
        }
        return false;
      }

      toast.success(`Compartido con ${target.display_name || target.email}`);
      return true;
    } catch (e: any) {
      console.error("Error sharing:", e);
      toast.error("Error al compartir");
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, findUserByEmail]);

  const revokeShare = useCallback(async (shareId: string) => {
    const { error } = await supabase.from("resource_shares").delete().eq("id", shareId);
    if (error) {
      toast.error("Error al revocar acceso");
      return false;
    }
    toast.success("Acceso revocado");
    return true;
  }, []);

  const updateShareRole = useCallback(async (shareId: string, newRole: ShareRole) => {
    const { error } = await supabase
      .from("resource_shares")
      .update({ role: newRole })
      .eq("id", shareId);
    if (error) {
      toast.error("Error al actualizar rol");
      return false;
    }
    toast.success("Rol actualizado");
    return true;
  }, []);

  const ALL_RESOURCE_TYPES: ResourceType[] = [
    "business_project", "task", "rag_project", "pattern_detector_run",
    "people_contact", "data_source", "check_in",
  ];

  const shareAllResources = useCallback(async (email: string, role: ShareRole = "editor") => {
    if (!user) return false;
    setLoading(true);
    try {
      const target = await findUserByEmail(email);
      if (!target) {
        toast.error("No se encontró un usuario con ese email");
        return false;
      }
      if (target.id === user.id) {
        toast.error("No puedes compartir contigo mismo");
        return false;
      }

      const rows = ALL_RESOURCE_TYPES.map((rt) => ({
        owner_id: user.id,
        shared_with_id: target.id,
        resource_type: rt,
        resource_id: null,
        role,
      }));

      const { error } = await supabase.from("resource_shares").upsert(rows, {
        onConflict: "owner_id,shared_with_id,resource_type,resource_id",
        ignoreDuplicates: true,
      });

      if (error) throw error;
      toast.success(`Todos los módulos compartidos con ${target.display_name || target.email}`);
      return true;
    } catch (e: any) {
      console.error("Error sharing all:", e);
      toast.error("Error al compartir todos los módulos");
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, findUserByEmail]);

  return {
    loading,
    findUserByEmail,
    getSharesForResource,
    getSharedWithMe,
    shareResource,
    shareAllResources,
    revokeShare,
    updateShareRole,
  };
};
