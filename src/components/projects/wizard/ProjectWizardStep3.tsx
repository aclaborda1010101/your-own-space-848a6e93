import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Check, Download, FileText } from "lucide-react";

interface Props {
  document: string | null;
  generating: boolean;
  onGenerate: () => void;
  onApprove: () => void;
}

export const ProjectWizardStep3 = ({ document, generating, onGenerate, onApprove }: Props) => {
  const [editMode, setEditMode] = useState(false);
  const [editedDoc, setEditedDoc] = useState(document || "");

  const handleExportMd = () => {
    const blob = new Blob([editedDoc || document || ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "documento-alcance.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!document && !generating) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div>
          <h2 className="text-lg font-bold text-foreground">Documento de Alcance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Claude Sonnet generará un documento profesional de alcance basado en el briefing aprobado.
          </p>
        </div>
        <Button onClick={onGenerate} className="gap-2">
          <FileText className="w-4 h-4" /> Generar documento de alcance
        </Button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Generando documento con Claude Sonnet...</p>
        <p className="text-xs text-muted-foreground/60">Esto puede tardar 30-60 segundos</p>
      </div>
    );
  }

  const displayDoc = editMode ? editedDoc : (document || "");

  // Extract TOC from markdown headings
  const headings = (displayDoc).match(/^#+\s+.+$/gm) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Documento de Alcance</h2>
          <p className="text-sm text-muted-foreground mt-1">Revisa, edita y aprueba el documento.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setEditMode(!editMode); if (!editMode) setEditedDoc(document || ""); }}>
            {editMode ? "Vista previa" : "Editar"}
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerate} className="gap-1">
            <RefreshCw className="w-3 h-3" /> Regenerar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMd} className="gap-1">
            <Download className="w-3 h-3" /> Exportar MD
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1">
            <Check className="w-3 h-3" /> Aprobar documento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* TOC sidebar */}
        {headings.length > 0 && (
          <Card className="border-border bg-card hidden lg:block">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground">ÍNDICE</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {headings.map((h, i) => {
                    const level = (h.match(/^#+/) || [""])[0].length;
                    const text = h.replace(/^#+\s+/, "");
                    return (
                      <p
                        key={i}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer truncate"
                        style={{ paddingLeft: `${(level - 1) * 12}px` }}
                      >
                        {text}
                      </p>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Document content */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            {editMode ? (
              <Textarea
                value={editedDoc}
                onChange={(e) => setEditedDoc(e.target.value)}
                rows={30}
                className="font-mono text-sm"
              />
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-foreground">
                  {displayDoc.split("\n").map((line, i) => {
                    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-foreground mt-6 mb-2">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-foreground mt-5 mb-2">{line.slice(3)}</h2>;
                    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1">{line.slice(4)}</h3>;
                    if (line.startsWith("- ")) return <p key={i} className="text-sm text-foreground ml-4">• {line.slice(2)}</p>;
                    if (line.trim() === "") return <br key={i} />;
                    return <p key={i} className="text-sm text-foreground">{line}</p>;
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
