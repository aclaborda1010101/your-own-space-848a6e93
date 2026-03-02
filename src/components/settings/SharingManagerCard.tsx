import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useSharing, ResourceType, ResourceShare } from "@/hooks/useSharing";
import { Loader2, Plus, Trash2, UserPlus, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

const MODULE_OPTIONS: { type: ResourceType; label: string }[] = [
  { type: "business_project", label: "Proyectos" },
  { type: "task", label: "Tareas" },
  { type: "rag_project", label: "RAG" },
  { type: "bl_audit", label: "Auditorías IA" },
  { type: "people_contact", label: "Contactos" },
  { type: "calendar", label: "Calendario" },
  { type: "data_source", label: "Fuentes de datos" },
  { type: "pattern_detector_run", label: "Detector de patrones" },
  { type: "check_in", label: "Check-in" },
];

interface SharedUser {
  userId: string;
  email: string;
  displayName: string;
  shares: ResourceShare[];
}

export const SharingManagerCard = () => {
  const { loading, getSharesForResource, shareResource, revokeShare, findUserByEmail } = useSharing();
  const [email, setEmail] = useState("");
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchAllShares = useCallback(async () => {
    setFetching(true);
    try {
      const allShares: ResourceShare[] = [];
      for (const mod of MODULE_OPTIONS) {
        const shares = await getSharesForResource(mod.type);
        allShares.push(...shares);
      }

      // Group by shared_with_id
      const userMap = new Map<string, SharedUser>();
      for (const share of allShares) {
        const existing = userMap.get(share.shared_with_id);
        if (existing) {
          existing.shares.push(share);
        } else {
          userMap.set(share.shared_with_id, {
            userId: share.shared_with_id,
            email: share.shared_with_email || share.shared_with_id,
            displayName: share.shared_with_name || share.shared_with_email || "Usuario",
            shares: [share],
          });
        }
      }
      setSharedUsers(Array.from(userMap.values()));
    } catch (e) {
      console.error("Error fetching shares:", e);
    } finally {
      setFetching(false);
    }
  }, [getSharesForResource]);

  useEffect(() => {
    fetchAllShares();
  }, []);

  const handleAddUser = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      const target = await findUserByEmail(email.trim());
      if (!target) {
        toast.error("No se encontró un usuario con ese email");
        setAdding(false);
        return;
      }
      // Share all modules by default
      for (const mod of MODULE_OPTIONS) {
        await shareResource(email.trim(), mod.type, "editor");
      }
      setEmail("");
      await fetchAllShares();
    } catch {
      toast.error("Error al añadir usuario");
    } finally {
      setAdding(false);
    }
  };

  const toggleModule = async (user: SharedUser, moduleType: ResourceType) => {
    const existingShare = user.shares.find((s) => s.resource_type === moduleType);
    if (existingShare) {
      await revokeShare(existingShare.id);
    } else {
      await shareResource(user.email, moduleType, "editor");
    }
    await fetchAllShares();
  };

  const selectAll = async (user: SharedUser) => {
    for (const mod of MODULE_OPTIONS) {
      const exists = user.shares.find((s) => s.resource_type === mod.type);
      if (!exists) {
        await shareResource(user.email, mod.type, "editor");
      }
    }
    await fetchAllShares();
  };

  const deselectAll = async (user: SharedUser) => {
    for (const share of user.shares) {
      await revokeShare(share.id);
    }
    await fetchAllShares();
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add user */}
      <div className="flex gap-2">
        <Input
          placeholder="Email del usuario..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
          className="flex-1 bg-background border-border"
        />
        <Button
          onClick={handleAddUser}
          disabled={adding || !email.trim()}
          size="sm"
          className="gap-1"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Añadir
        </Button>
      </div>

      {sharedUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No compartes con ningún usuario todavía
        </p>
      ) : (
        <div className="space-y-4">
          {sharedUsers.map((user) => {
            const sharedTypes = new Set(user.shares.map((s) => s.resource_type));
            const allSelected = MODULE_OPTIONS.every((m) => sharedTypes.has(m.type));

            return (
              <div key={user.userId} className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deselectAll(user)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (allSelected ? deselectAll(user) : selectAll(user))}
                    className="text-xs h-7 gap-1"
                  >
                    {allSelected ? <Square className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
                    {allSelected ? "Quitar todo" : "Seleccionar todo"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MODULE_OPTIONS.map((mod) => {
                    const isShared = sharedTypes.has(mod.type);
                    return (
                      <label
                        key={mod.type}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={isShared}
                          onCheckedChange={() => toggleModule(user, mod.type)}
                          className="border-primary data-[state=checked]:bg-primary"
                        />
                        <span className={isShared ? "text-foreground" : "text-muted-foreground"}>
                          {mod.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
