import { Rocket } from "lucide-react";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Badge } from "@/components/ui/badge";

interface ProjectLaunchPanelProps {
  projectId: string;
  projectName: string;
}

export const ProjectLaunchPanel = ({ projectId, projectName }: ProjectLaunchPanelProps) => {
  return (
    <CollapsibleCard
      id="launch"
      title="Lanzamiento del Producto"
      icon={<Rocket className="w-4 h-4 text-primary" />}
      defaultOpen={false}
      badge={
        <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/20 text-primary">
          Próximamente
        </Badge>
      }
    >
      <div className="p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
          <Rocket className="w-6 h-6 text-primary/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Aquí se gestionará el lanzamiento del producto: descripción del MVP, checklist de lanzamiento, métricas de éxito y seguimiento post-lanzamiento.
        </p>
      </div>
    </CollapsibleCard>
  );
};
