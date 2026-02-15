import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";

export interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2" | "P3";
  duration: number;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  dueDate?: Date | null;
  source?: string;
  description?: string | null;
}

export function autoPriority(dueDate: Date | null | undefined): "P0" | "P1" | "P2" | "P3" {
  if (!dueDate) return "P3";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = differenceInCalendarDays(dueDate, today);
  if (days <= 0) return "P0";
  if (days <= 3) return "P1";
  if (days <= 7) return "P2";
  return "P3";
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

      const mapped = data.map((t) => {
        const dueDate = (t as any).due_date ? new Date((t as any).due_date + "T00:00:00") : null;
        const computedPriority = t.completed ? t.priority : autoPriority(dueDate);
        return {
          id: t.id,
          title: t.title,
          type: t.type as "work" | "life" | "finance",
          priority: computedPriority as "P0" | "P1" | "P2" | "P3",
          duration: t.duration,
          completed: t.completed,
          createdAt: new Date(t.created_at),
          completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
          dueDate,
          source: (t as any).source || "manual",
          description: (t as any).description || null,
        };
      });
      mapped.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        return pOrder[a.priority] - pOrder[b.priority];
      });
      setTasks(mapped);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      toast.error("Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (task: Omit<Task, "id" | "createdAt" | "completedAt" | "completed">) => {
    if (!user) return;

    const dueDateStr = task.dueDate ? task.dueDate.toISOString().split("T")[0] : null;
    const computedPriority = autoPriority(task.dueDate);

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: task.title,
          type: task.type,
          priority: computedPriority,
          duration: task.duration,
          completed: false,
          due_date: dueDateStr,
          source: task.source || "manual",
          description: task.description || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const dueDate = (data as any).due_date ? new Date((data as any).due_date + "T00:00:00") : null;
      setTasks((prev) => {
        const newList = [
          {
            id: data.id,
            title: data.title,
            type: data.type as "work" | "life" | "finance",
            priority: computedPriority,
            duration: data.duration,
            completed: data.completed,
            createdAt: new Date(data.created_at),
            dueDate,
            source: (data as any).source || "manual",
            description: (data as any).description || null,
          },
          ...prev,
        ];
        newList.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          const pOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
          return pOrder[a.priority] - pOrder[b.priority];
        });
        return newList;
      });

      toast.success("Tarea creada");
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Error al crear tarea");
    }
  };

  const updateTask = async (id: string, updates: { due_date?: string | null; description?: string | null }) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update(updates as any)
        .eq("id", id);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const newDueDate = updates.due_date !== undefined
            ? (updates.due_date ? new Date(updates.due_date + "T00:00:00") : null)
            : t.dueDate;
          const newPriority = t.completed ? t.priority : autoPriority(newDueDate);
          return {
            ...t,
            dueDate: newDueDate,
            priority: newPriority,
            description: updates.description !== undefined ? updates.description : t.description,
          };
        })
      );
      toast.success("Tarea actualizada");
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Error al actualizar tarea");
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
    updateTask,
    toggleComplete,
    deleteTask,
    refetch: fetchTasks,
  };
};
