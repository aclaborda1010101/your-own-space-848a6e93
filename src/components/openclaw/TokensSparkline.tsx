import { useMemo } from "react";

interface Props {
  // Pares [timestamp ISO, tokens_used]
  executions: Array<{ started_at: string; tokens_used: number; node_id: string }>;
  nodeId: string;
  className?: string;
}

// Sparkline minimalista de tokens consumidos en las últimas 24h, agregados por hora.
export function TokensSparkline({ executions, nodeId, className }: Props) {
  const buckets = useMemo(() => {
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const arr = new Array(24).fill(0);
    for (const ex of executions) {
      if (ex.node_id !== nodeId) continue;
      const t = new Date(ex.started_at).getTime();
      const ageH = Math.floor((now - t) / HOUR);
      if (ageH < 0 || ageH >= 24) continue;
      arr[23 - ageH] += ex.tokens_used || 0;
    }
    return arr;
  }, [executions, nodeId]);

  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((a, b) => a + b, 0);
  const width = 120;
  const height = 28;
  const stepX = width / (buckets.length - 1 || 1);

  const points = buckets
    .map((v, i) => `${(i * stepX).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`)
    .join(" ");

  return (
    <div className={className} title={`${total.toLocaleString()} tokens · últimas 24h`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden
      >
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={`0,${height} ${points} ${width},${height}`}
          fill="hsl(var(--primary) / 0.12)"
          stroke="none"
        />
      </svg>
    </div>
  );
}
