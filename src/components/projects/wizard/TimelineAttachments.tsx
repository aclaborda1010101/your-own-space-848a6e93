import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, FileText, Loader2 } from "lucide-react";
import { extractTextFromFile } from "@/lib/document-text-extract";
import { toast } from "sonner";

interface Attachment {
  file: File;
  name: string;
  extractedText?: string;
  uploading?: boolean;
}

interface Props {
  onAttachmentsReady: (attachments: { file_name: string; storage_path: string; mime_type: string; size_bytes: number; extracted_text: string }[]) => void;
  projectId: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/json",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
];

export const TimelineAttachments = ({ onAttachmentsReady, projectId }: Props) => {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    setProcessing(true);
    const newFiles: Attachment[] = [];

    for (const file of selected) {
      let extractedText = "";
      try {
        if (file.type.startsWith("audio/")) {
          // Use speech-to-text for audio
          const formData = new FormData();
          formData.append("file", file);
          formData.append("language", "es");
          const { data, error } = await supabase.functions.invoke("speech-to-text", { body: formData });
          if (!error && data?.text) extractedText = data.text;
        } else {
          const result = await extractTextFromFile(file);
          extractedText = result.text;
        }
      } catch (err) {
        console.warn("Text extraction failed for", file.name, err);
      }
      newFiles.push({ file, name: file.name, extractedText });
    }

    setFiles(prev => [...prev, ...newFiles]);
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAll = async (): Promise<{ file_name: string; storage_path: string; mime_type: string; size_bytes: number; extracted_text: string }[]> => {
    const results: { file_name: string; storage_path: string; mime_type: string; size_bytes: number; extracted_text: string }[] = [];

    for (const att of files) {
      const path = `${projectId}/timeline_attachments/${Date.now()}_${att.name}`;
      const { error } = await supabase.storage
        .from("project-documents")
        .upload(path, att.file);

      if (error) {
        console.error("Upload error:", error);
        toast.error(`Error al subir ${att.name}`);
        continue;
      }

      results.push({
        file_name: att.name,
        storage_path: path,
        mime_type: att.file.type,
        size_bytes: att.file.size,
        extracted_text: att.extractedText || "",
      });
    }

    onAttachmentsReady(results);
    setFiles([]);
    return results;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
        >
          {processing ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Paperclip className="w-3 h-3 mr-1" />
          )}
          Adjuntar archivos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.mp3,.m4a,.wav,.webm,.ogg"
          onChange={handleFilesSelected}
        />
        {files.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {files.length} archivo{files.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border/50 text-[10px]"
            >
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span className="max-w-[120px] truncate text-foreground">{f.name}</span>
              {f.extractedText && (
                <Badge variant="outline" className="text-[8px] px-1 py-0">
                  texto
                </Badge>
              )}
              <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Expose uploadAll for parent
};

// Export uploadAll-capable ref pattern
export { type Attachment };
