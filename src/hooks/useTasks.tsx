import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { recordFeedback } from "@/lib/jarvisFeedback";

export interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2";
  duration: number;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  projectId?: string;
  projectName?: string;
  contactId?: string;
  contactName?: string;
  isPersonal: boolean;
}

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTasks();
    } else {
      setTasks([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, business_projects(name), people_contacts(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTasks(
        data.map((t: any) => ({
          id: t.id,
          title: t.title,
          type: t.type as "work" | "life" | "finance",
          priority: t.priority as "P0" | "P1" | "P2",
          duration: t.duration,
          completed: t.completed,
          createdAt: new Date(t.created_at),
          completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
          projectId: t.project_id || undefined,
          projectName: t.business_projects?.name || undefined,
          contactId: t.contact_id || undefined,
          contactName: t.people_contacts?.name || undefined,
          isPersonal: t.is_personal ?? true,
        }))
      );
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      toast.error("Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (
    task: Omit<Task, "id" | "createdAt" | "completedAt" | "completed" | "isPersonal" | "contactId" | "contactName" | "projectId" | "projectName"> & {
      isPersonal?: boolean;
      contactId?: string | null;
      projectId?: string | null;
    }
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: task.title,
          type: task.type,
          priority: task.priority,
          duration: task.duration,
          completed: false,
          // PRIVADO POR DEFECTO: si no se indica nada, la tarea es personal/privada.
          is_personal: task.isPersonal ?? true,
          contact_id: task.contactId ?? null,
          project_id: task.projectId ?? null,
        })
        .select("*, business_projects(name), people_contacts(name)")
        .single();

      if (error) throw error;

      setTasks((prev) => [
        {
          id: data.id,
          title: data.title,
          type: data.type as "work" | "life" | "finance",
          priority: data.priority as "P0" | "P1" | "P2",
          duration: data.duration,
          completed: data.completed,
          createdAt: new Date(data.created_at),
          isPersonal: data.is_personal ?? true,
          contactId: data.contact_id || undefined,
          contactName: (data as any).people_contacts?.name || undefined,
          projectId: data.project_id || undefined,
          projectName: (data as any).business_projects?.name || undefined,
        },
        ...prev,
      ]);

      toast.success("Tarea creada");
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Error al crear tarea");
    }
  };

  const toggleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, completed: newCompleted, completedAt: newCompleted ? new Date() : undefined }
            : t
        )
      );
    } catch (error: any) {
      console.error("Error toggling task:", error);
      toast.error("Error al actualizar tarea");
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);

      if (error) throw error;

      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tarea eliminada");
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error("Error al eliminar tarea");
    }
  };

  const updateTask = async (
    id: string,
    updates: Partial<Pick<Task, "title" | "type" | "priority" | "duration" | "isPersonal" | "contactId">>,
  ) => {
    try {
      const previous = tasks.find((t) => t.id === id);
      const dbUpdates: Record<string, any> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.isPersonal !== undefined) dbUpdates.is_personal = updates.isPersonal;
      if (updates.contactId !== undefined) dbUpdates.contact_id = updates.contactId || null;

      const { error } = await supabase
        .from("tasks")
        .update(dbUpdates)
        .eq("id", id);

      if (error) throw error;

      // Feedback loop: detectar cambios manuales de prioridad
      if (
        previous &&
        updates.priority !== undefined &&
        updates.priority !== previous.priority
      ) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          recordFeedback({
            userId: user.id,
            feedbackType: "priority_change",
            suggestionType: "task_priority",
            sourceId: id,
            initialValue: { priority: previous.priority },
            correctedValue: { priority: updates.priority },
            context: { task_type: previous.type, title: previous.title },
          });
        }
      }

      // Si cambió el contacto, refetch para traer el nombre vinculado.
      if (updates.contactId !== undefined) {
        await fetchTasks();
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          )
        );
      }
      toast.success("Tarea actualizada");
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Error al actualizar tarea");
    }
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return {
    tasks,
    pendingTasks,
    completedTasks,
    loading,
    addTask,
    toggleComplete,
    deleteTask,
    updateTask,
    refetch: fetchTasks,
  };
};
