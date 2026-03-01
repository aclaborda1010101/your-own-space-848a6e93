import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useSharing, ResourceType, ShareRole, ResourceShare } from "@/hooks/useSharing";
import { Share2, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ShareDialogProps {
  resourceType: ResourceType;
  resourceId?: string;
  resourceName: string;
  trigger?: React.ReactNode;
}

export const ShareDialog = ({ resourceType, resourceId, resourceName, trigger }: ShareDialogProps) => {
  const { shareResource, shareAllResources, getSharesForResource, revokeShare, updateShareRole, loading } = useSharing();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [shareAll, setShareAll] = useState(false);
  const [shares, setShares] = useState<ResourceShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  const loadShares = async () => {
    setLoadingShares(true);
    const data = await getSharesForResource(resourceType, resourceId);
    setShares(data);
    setLoadingShares(false);
  };

  useEffect(() => {
    if (open) loadShares();
  }, [open]);

  const handleShare = async () => {
    if (!email.trim()) return;
    let ok: boolean;
    if (shareAll) {
      ok = await shareAllResources(email.trim(), role);
    } else {
      ok = await shareResource(email.trim(), resourceType, role, resourceId);
    }
    if (ok) {
      setEmail("");
      await loadShares();
    }
  };

  const handleRevoke = async (shareId: string) => {
    const ok = await revokeShare(shareId);
    if (ok) setShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  const handleRoleChange = async (shareId: string, newRole: ShareRole) => {
    const ok = await updateShareRole(shareId, newRole);
    if (ok) setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, role: newRole } : s));
  };

  const resourceLabel: Record<ResourceType, string> = {
    business_project: "Proyecto",
    task: "Tarea",
    rag_project: "RAG",
    pattern_detector_run: "Detector",
    people_contact: "Contacto",
    calendar: "Calendario",
    check_in: "Check-in",
    data_source: "Fuente de datos",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Compartir {resourceLabel[resourceType]}
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{resourceName}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add share */}
          <div className="flex gap-2">
            <Input
              placeholder="Email del usuario..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleShare()}
              className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as ShareRole)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleShare} disabled={loading || !email.trim()} size="sm">
              Añadir
            </Button>
          </div>

          {/* Share all checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-all"
              checked={shareAll}
              onCheckedChange={(v) => setShareAll(!!v)}
            />
            <label htmlFor="share-all" className="text-sm text-muted-foreground cursor-pointer">
              Compartir todos los módulos (proyectos, tareas, contactos, RAG, detector, datos)
            </label>
          </div>

          {/* Current shares */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {loadingShares ? "Cargando..." : `${shares.length} usuario(s) con acceso`}
            </p>
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {share.shared_with_email || share.shared_with_id.slice(0, 8) + "..."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={share.role}
                    onValueChange={(v) => handleRoleChange(share.id, v as ShareRole)}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRevoke(share.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Small badge to show shared status */
export const SharedBadge = ({ isOwner = true }: { isOwner?: boolean }) => {
  if (isOwner) return null;
  return (
    <Badge variant="secondary" className="text-xs gap-1">
      <Share2 className="h-3 w-3" />
      Compartido
    </Badge>
  );
};
