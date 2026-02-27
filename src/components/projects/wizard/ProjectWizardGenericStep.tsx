import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Check, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  stepNumber: number;
  stepName: string;
  description: string;
  outputData: any;
  generating: boolean;
  onGenerate: () => Promise<void>;
  onApprove: () => Promise<void>;
  generateLabel?: string;
  isMarkdown?: boolean;
}

export const ProjectWizardGenericStep = ({
  stepNumber,
  stepName,
  description,
  outputData,
  generating,
  onGenerate,
  onApprove,
  generateLabel = "Generar",
  isMarkdown = false,
}: Props) => {
  const hasOutput = outputData !== null && outputData !== undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{stepNumber}</span>
            </div>
            <div>
              <CardTitle className="text-lg">{stepName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          {hasOutput && (
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              Generado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate button */}
        {!hasOutput && !generating && (
          <Button onClick={onGenerate} className="gap-2 w-full">
            <Play className="w-4 h-4" />
            {generateLabel}
          </Button>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Generando {stepName.toLowerCase()}...</p>
          </div>
        )}

        {/* Output display */}
        {hasOutput && !generating && (
          <>
            <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-muted/20 p-4">
              {isMarkdown ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {typeof outputData === "string" ? outputData : outputData?.document || JSON.stringify(outputData, null, 2)}
                </div>
              ) : (
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                  {typeof outputData === "string" ? outputData : JSON.stringify(outputData, null, 2)}
                </pre>
              )}
            </ScrollArea>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onGenerate} className="gap-2 flex-1">
                <Play className="w-4 h-4" />
                Regenerar
              </Button>
              <Button onClick={onApprove} className="gap-2 flex-1">
                <Check className="w-4 h-4" />
                Aprobar y continuar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
