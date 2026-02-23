import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FlaskConical, ExternalLink } from "lucide-react";

export interface EvidenceChunk {
  chunk_id: string;
  chunk_index: number;
  content_preview: string;
  rrf_score: number;
  boosted_score: number;
  similarity: number;
  source_name: string;
  source_url: string;
  source_tier: string;
  authority_score: number;
  subdomain: string;
}

interface RagEvidenceInspectorProps {
  evidenceChunks: EvidenceChunk[];
  claimMap: Record<string, string[]>;
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "tier1_gold" || tier === "A") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">🥇 Gold</Badge>;
  if (tier === "tier2_silver" || tier === "B") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">🥈 Silver</Badge>;
  return <Badge className="bg-muted/50 text-muted-foreground text-[10px]">🥉 Bronze</Badge>;
}

export function RagEvidenceInspector({ evidenceChunks, claimMap }: RagEvidenceInspectorProps) {
  if (!evidenceChunks || evidenceChunks.length === 0) return null;

  const claimEntries = Object.entries(claimMap || {});

  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <FlaskConical className="h-3 w-3" />
        <ChevronDown className="h-3 w-3" />
        Inspector de Evidencia ({evidenceChunks.length} chunks)
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {/* Chunks */}
        {evidenceChunks.map((chunk) => (
          <div key={chunk.chunk_id} className="text-xs bg-background/50 rounded p-2 border border-muted/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Badge variant="outline" className="text-[10px] px-1">[Chunk {chunk.chunk_index}]</Badge>
              <TierBadge tier={chunk.source_tier} />
              <span className="text-muted-foreground">{chunk.subdomain}</span>
            </div>
            <p className="text-muted-foreground mb-1.5">{chunk.content_preview}</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">RRF:</span>
                <span className="font-mono">{chunk.rrf_score.toFixed(3)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Sim:</span>
                <Progress value={chunk.similarity * 100} className="w-12 h-1.5" />
                <span className="font-mono">{(chunk.similarity * 100).toFixed(0)}%</span>
              </div>
              {chunk.authority_score > 0 && (
                <span className="text-yellow-400">{Number(chunk.authority_score).toFixed(1)}★</span>
              )}
            </div>
            {chunk.source_url && (
              <a href={chunk.source_url} target="_blank" rel="noopener noreferrer" className="text-primary/70 hover:text-primary flex items-center gap-0.5 mt-1">
                <span className="truncate max-w-[200px]">{chunk.source_name || chunk.source_url}</span>
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
              </a>
            )}
          </div>
        ))}

        {/* Claim Map */}
        {claimEntries.length > 0 && (
          <div className="border-t border-muted/30 pt-2">
            <p className="text-[10px] text-muted-foreground font-semibold mb-1">MAPA DE CLAIMS</p>
            {claimEntries.map(([claim, chunks], i) => (
              <div key={i} className="text-[10px] flex gap-1 mb-0.5">
                <span className="text-primary/60">→</span>
                <span className="text-muted-foreground flex-1">{claim}</span>
                <span className="text-foreground font-mono">[{chunks.join(",")}]</span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
