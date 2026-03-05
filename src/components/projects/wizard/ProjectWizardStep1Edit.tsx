import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, Pencil, Save, ArrowRight, Sparkles, Plus, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  inputContent: string;
  onUpdateContent: (content: string) => Promise<void>;
  onGoToExtraction: () => void;
  onReExtract: () => void;
  hasExistingBriefing: boolean;
  generating: boolean;
}

export const ProjectWizardStep1Edit = ({
  inputContent,
  onUpdateContent,
  onGoToExtraction,
  onReExtract,
  hasExistingBriefing,
  generating,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inputContent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateContent(draft);
    setSaving(false);
    setEditing(false);
  };

  const handleSaveAndReExtract = async () => {
    setSaving(true);
    await onUpdateContent(draft);
    setSaving(false);
    setEditing(false);
    onReExtract();
  };

  const hasChanges = draft !== inputContent;

  if (!editing) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">Entrada completada</h2>
              <p className="text-sm text-muted-foreground mt-1">
                El proyecto se ha creado correctamente. Puedes editar el material de entrada si necesitas añadir o corregir información.
              </p>
            </div>
          </div>

          {/* Preview of current content */}
          <Card className="border-border/30 bg-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Material de entrada · {inputContent.length.toLocaleString()} caracteres
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {inputContent.split(/\s+/).length.toLocaleString()} palabras
                </Badge>
              </div>
              <ScrollArea className="h-32">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-8">
                  {inputContent}
                </p>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setDraft(inputContent); setEditing(true); }} className="gap-2">
              <Pencil className="w-4 h-4" /> Editar material
            </Button>
            {hasExistingBriefing ? (
              <Button onClick={onGoToExtraction} className="gap-2">
                Ir a Extracción <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={onReExtract} className="gap-2 shadow-lg shadow-primary/20" disabled={generating}>
                <Sparkles className="w-4 h-4" /> Extraer briefing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Editing mode
  return (
    <Card className="border-primary/30 border-2">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Pencil className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Editar Material de Entrada</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Añade, corrige o amplía el contenido. Al guardar se regenerará el briefing automáticamente.
            </p>
          </div>
        </div>

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          className="text-sm bg-background resize-y min-h-[200px] font-mono"
          placeholder="Pega aquí la transcripción, notas de reunión o descripción del proyecto..."
        />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            {draft.length.toLocaleString()} caracteres · {draft.split(/\s+/).filter(Boolean).length.toLocaleString()} palabras
            {hasChanges && (
              <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/40 text-amber-600">
                Sin guardar
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setDraft(inputContent); setEditing(false); }} size="sm">
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="sm"
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Solo guardar
            </Button>
            <Button
              onClick={handleSaveAndReExtract}
              disabled={saving || generating}
              size="sm"
              className="gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Guardar y re-extraer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
