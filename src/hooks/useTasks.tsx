import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2";
  duration: number;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTasks(
        data.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type as "work" | "life" | "finance",
          priority: t.priority as "P0" | "P1" | "P2",
          duration: t.duration,
          completed: t.completed,
          createdAt: new Date(t.created_at),
          completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
        }))
      );
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      toast.error("Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (task: Omit<Task, "id" | "createdAt" | "completedAt" | "completed">) => {
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
        })
        .select()
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
    refetch: fetchTasks,
  };
};
