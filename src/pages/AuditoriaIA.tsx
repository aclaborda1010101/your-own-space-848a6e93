import { useState } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { BusinessLeverageTabs } from "@/components/projects/BusinessLeverageTabs";
import { useProjects } from "@/hooks/useProjects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";

const AuditoriaIA = () => {
  const { projects, loading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const activeProjects = projects.filter(
    (p) => p.status !== "closed_won" && p.status !== "closed_lost"
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Auditoría IA</h1>
        </div>
        <ShareDialog
          resourceType="business_project"
          resourceName="Auditoría IA"
        />

        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder={loading ? "Cargando proyectos..." : "Selecciona un proyecto"} />
          </SelectTrigger>
          <SelectContent>
            {activeProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
            {activeProjects.length === 0 && !loading && (
              <SelectItem value="_none" disabled>
                No hay proyectos activos
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedProjectId ? (
        <BusinessLeverageTabs
          projectId={selectedProjectId}
          projectSector={selectedProject?.sector ?? undefined}
          projectSize={selectedProject?.business_size ?? undefined}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
          <p className="text-sm text-muted-foreground">
            Selecciona un proyecto para iniciar la auditoría IA
          </p>
        </div>
      )}
    </main>
  );
};

export default AuditoriaIA;
