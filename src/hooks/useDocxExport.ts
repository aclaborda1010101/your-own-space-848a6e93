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
        window.open(data.url, "_blank");
        toast.success("Documento DOCX generado");
      } else {
        throw new Error("No URL returned");
      }
    } catch (err: any) {
      console.error("DOCX export error:", err);
      toast.error("Error al generar DOCX");
    } finally {
      setGeneratingDocx(false);
    }
  };

  return { generatingDocx, exportDocx };
}
