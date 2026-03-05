import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId: string;
  stepNumber: number;
  content: any;
  contentType: "markdown" | "json";
  projectName: string;
  company?: string;
  version?: number;
  variant?: "default" | "outline";
  size?: "sm" | "default";
}

export const ProjectDocumentDownload = ({
  projectId,
  stepNumber,
  content,
  contentType,
  projectName,
  company = "",
  version = 1,
  variant = "outline",
  size = "sm",
}: Props) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!content) return;
    setDownloading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          projectId,
          stepNumber,
          content,
          contentType,
          projectName,
          company,
          date: new Date().toISOString().split("T")[0],
          version: `v${version}`,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No download URL returned");

      // Fetch as blob to avoid cross-origin download blocking
      const response = await fetch(data.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = data.fileName || `documento-fase-${stepNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast.success("Documento PDF descargado");
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Error al generar PDF: " + (err.message || "Error desconocido"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={downloading || !content}
      className="gap-1.5"
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {downloading ? "Generando..." : "PDF"}
    </Button>
  );
};
