import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Check, Download, FileText, PenLine } from "lucide-react";

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
      <Card className="border-border/50">
        <CardContent className="p-8 space-y-6 max-w-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Documento de Alcance</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Claude Sonnet generará un documento profesional de alcance basado en el briefing aprobado.
              </p>
            </div>
          </div>
          <Button onClick={onGenerate} className="gap-2 shadow-lg shadow-primary/20" size="lg">
            <FileText className="w-4 h-4" /> Generar documento de alcance
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Generando con Claude Sonnet...</p>
            <p className="text-xs text-muted-foreground mt-1">Esto puede tardar 30-60 segundos</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayDoc = editMode ? editedDoc : (document || "");
  const headings = displayDoc.match(/^#+\s+.+$/gm) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Documento de Alcance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Revisa, edita y aprueba el documento generado.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setEditMode(!editMode); if (!editMode) setEditedDoc(document || ""); }} className="gap-1.5">
            <PenLine className="w-3.5 h-3.5" /> {editMode ? "Vista previa" : "Editar"}
          </Button>
          <Button variant="outline" size="sm" onClick={onGenerate} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMd} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1.5 shadow-sm">
            <Check className="w-3.5 h-3.5" /> Aprobar documento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* TOC sidebar */}
        {headings.length > 0 && (
          <Card className="border-border/50 hidden lg:block">
            <CardContent className="p-3">
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">Índice</p>
              <ScrollArea className="h-[500px]">
                <div className="space-y-0.5">
                  {headings.map((h, i) => {
                    const level = (h.match(/^#+/) || [""])[0].length;
                    const text = h.replace(/^#+\s+/, "");
                    return (
                      <p
                        key={i}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer truncate py-1 px-1 rounded hover:bg-muted/30 transition-colors"
                        style={{ paddingLeft: `${(level - 1) * 12 + 4}px` }}
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
        <Card className="border-border/50">
          <CardContent className="p-5">
            {editMode ? (
              <Textarea
                value={editedDoc}
                onChange={(e) => setEditedDoc(e.target.value)}
                rows={30}
                className="font-mono text-sm bg-background resize-none"
              />
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="prose prose-sm prose-invert max-w-none">
                  {displayDoc.split("\n").map((line, i) => {
                    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-foreground mt-8 mb-3 first:mt-0">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-2">{line.slice(3)}</h2>;
                    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-foreground mt-5 mb-1.5">{line.slice(4)}</h3>;
                    if (line.startsWith("- ")) return <p key={i} className="text-sm text-foreground/85 ml-4 py-0.5">• {line.slice(2)}</p>;
                    if (line.trim() === "") return <div key={i} className="h-3" />;
                    return <p key={i} className="text-sm text-foreground/85 leading-relaxed">{line}</p>;
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
