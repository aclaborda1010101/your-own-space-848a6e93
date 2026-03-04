import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Check, FileText, PenLine } from "lucide-react";
import { ProjectDocumentDownload } from "./ProjectDocumentDownload";

interface Props {
  document: string | null;
  generating: boolean;
  onGenerate: () => void;
  onApprove: () => void;
  projectId?: string;
  projectName?: string;
  company?: string;
  version?: number;
}

export const ProjectWizardStep3 = ({ document, generating, onGenerate, onApprove, projectId, projectName, company, version = 1 }: Props) => {
  const [editMode, setEditMode] = useState(false);
  const [editedDoc, setEditedDoc] = useState(document || "");

  if (!document && !generating) {
          {projectId && document && (
            <ProjectDocumentDownload
              projectId={projectId}
              stepNumber={3}
              content={editedDoc || document}
              contentType="markdown"
              projectName={projectName || ""}
              company={company}
              version={version}
              size="sm"
            />
          )}
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
