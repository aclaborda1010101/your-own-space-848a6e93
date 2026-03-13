import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PotusAction {
  type: "create_task" | "navigate" | "agent_command" | "mark_done" | "notify";
  params: Record<string, unknown>;
}

export function usePotusActions() {
  const navigate = useNavigate();

  const executeAction = useCallback(
    async (action: PotusAction) => {
      try {
        switch (action.type) {
          case "create_task": {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No auth");
            await (supabase as any).from("todos").insert({
              user_id: user.id,
              title: String(action.params.title || "Nueva tarea"),
              priority: Number(action.params.priority ?? 3),
              is_completed: false,
            });
            toast.success("Tarea creada: " + action.params.title);
            break;
          }

          case "navigate": {
            const route = String(action.params.route || "/");
            navigate(route);
            break;
          }

          case "mark_done": {
            await (supabase as any)
              .from("todos")
              .update({ is_completed: true })
              .eq("id", String(action.params.taskId));
            toast.success("Tarea completada");
            break;
          }

          case "agent_command": {
            toast.info(`Comando: ${action.params.command || "restart"} → ${action.params.nodeId || "potus"}`);
            break;
          }

          case "notify": {
            toast(String(action.params.message || "Notificación"));
            break;
          }
        }
      } catch (err) {
        console.error("PotusAction error:", err);
        toast.error("Error ejecutando acción");
      }
    },
    [navigate]
  );

  const parseActionsFromResponse = useCallback(
    (data: Record<string, unknown>): PotusAction[] => {
      if (Array.isArray(data?.actions)) {
        return data.actions as PotusAction[];
      }
      return [];
    },
    []
  );

  return { executeAction, parseActionsFromResponse };
}
