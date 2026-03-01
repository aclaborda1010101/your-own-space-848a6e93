import { useState, useEffect } from "react";
import { useSharing, ResourceShare, ResourceType } from "@/hooks/useSharing";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, CheckSquare, Database, Radar, Users, HardDrive, Activity, ShieldCheck } from "lucide-react";

const typeConfig: Record<ResourceType, { label: string; icon: React.ElementType }> = {
  business_project: { label: "Proyectos", icon: Briefcase },
  task: { label: "Tareas", icon: CheckSquare },
  rag_project: { label: "RAG", icon: Database },
  pattern_detector_run: { label: "Detector", icon: Radar },
  people_contact: { label: "Contactos", icon: Users },
  calendar: { label: "Calendario", icon: Activity },
  check_in: { label: "Check-ins", icon: Activity },
  data_source: { label: "Datos", icon: HardDrive },
  bl_audit: { label: "Auditoría IA", icon: ShieldCheck },
};

export const SharedWithMeCard = () => {
  const { getSharedWithMe, findUserByEmail } = useSharing();
  const [shares, setShares] = useState<(ResourceShare & { ownerEmail?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getSharedWithMe();
      setShares(data);
      setLoading(false);
    };
    load();
  }, [getSharedWithMe]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando...</span>
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nadie ha compartido recursos contigo todavía.
      </p>
    );
  }

  // Group by owner
  const grouped = shares.reduce<Record<string, ResourceShare[]>>((acc, share) => {
    const key = share.owner_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(share);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([ownerId, ownerShares]) => (
        <div key={ownerId} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
          <p className="text-sm font-medium text-foreground">
            De: {ownerId.slice(0, 8)}...
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ownerShares.map((share) => {
              const config = typeConfig[share.resource_type];
              const Icon = config?.icon;
              return (
                <Badge key={share.id} variant="outline" className="gap-1 text-xs">
                  {Icon && <Icon className="h-3 w-3" />}
                  {config?.label || share.resource_type}
                  <span className="text-muted-foreground">({share.role})</span>
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
