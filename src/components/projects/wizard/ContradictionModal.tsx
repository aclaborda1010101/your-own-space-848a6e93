import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface Contradiction {
  concepto: string;
  valor_1: string;
  seccion_1: string;
  valor_2: string;
  seccion_2: string;
}

interface Props {
  open: boolean;
  contradictions: Contradiction[];
  onResolve: (resolved: Record<number, "valor_1" | "valor_2">) => void;
  onClose: () => void;
}

export const ContradictionModal = ({ open, contradictions, onResolve, onClose }: Props) => {
  const [selections, setSelections] = useState<Record<number, "valor_1" | "valor_2">>({});
  const [expanded, setExpanded] = useState<number | null>(0);

  const allResolved = contradictions.length > 0 && Object.keys(selections).length === contradictions.length;

  const select = (idx: number, choice: "valor_1" | "valor_2") => {
    setSelections(prev => ({ ...prev, [idx]: choice }));
    // Auto-expand next unresolved
    const next = contradictions.findIndex((_, i) => i > idx && !selections[i]);
    if (next !== -1) setExpanded(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {contradictions.length} contradicción{contradictions.length !== 1 ? "es" : ""} detectada{contradictions.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Se encontraron valores inconsistentes en el documento. Resuelve cada una eligiendo qué valor mantener antes de continuar a la auditoría.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-2">
            {contradictions.map((c, idx) => {
              const isExpanded = expanded === idx;
              const resolved = selections[idx];
              return (
                <div key={idx} className={`border rounded-lg transition-colors ${resolved ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                  <button
                    className="w-full flex items-center justify-between p-3 text-left"
                    onClick={() => setExpanded(isExpanded ? null : idx)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {resolved ? (
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{c.concepto}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      <button
                        className={`w-full text-left p-2 rounded-md border text-sm transition-colors ${resolved === "valor_1" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        onClick={() => select(idx, "valor_1")}
                      >
                        <Badge variant="outline" className="text-[10px] mb-1">{c.seccion_1}</Badge>
                        <p className="text-xs">{c.valor_1}</p>
                      </button>
                      <button
                        className={`w-full text-left p-2 rounded-md border text-sm transition-colors ${resolved === "valor_2" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        onClick={() => select(idx, "valor_2")}
                      >
                        <Badge variant="outline" className="text-[10px] mb-1">{c.seccion_2}</Badge>
                        <p className="text-xs">{c.valor_2}</p>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onResolve(selections)} disabled={!allResolved} className="gap-2">
            <Check className="w-4 h-4" />
            Resolver y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
