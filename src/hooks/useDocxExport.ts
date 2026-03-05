import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useDocxExport() {
  const [generatingDocx, setGeneratingDocx] = useState(false);

  const exportDocx = async (opts: {
    auditId: string;
    auditName: string;
    stepNumber: number;
    markdownContent: string;
  }) => {
    setGeneratingDocx(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: {
          projectId: opts.auditId,
          stepNumber: opts.stepNumber,
          content: opts.markdownContent,
          contentType: "markdown",
          projectName: opts.auditName,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const response = await fetch(data.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${opts.auditName || "documento"}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        toast.success("Documento PDF generado");
      } else {
        throw new Error("No URL returned");
      }
    } catch (err: any) {
      console.error("DOCX export error:", err);
      toast.error("Error al generar PDF");
    } finally {
      setGeneratingDocx(false);
    }
  };

  return { generatingDocx, exportDocx };
}
