import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, RefreshCw, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import type { PodcastRow, PodcastSegment } from "@/hooks/useContactPodcast";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface PodcastPlayerProps {
  podcast: PodcastRow | null;
  segments: PodcastSegment[];
  busy: boolean;
  totalMessages: number;
  contactName: string;
  onRegenerate: (opts: { format?: "narrator" | "dialogue"; full?: boolean }) => void;
  onSetFormat: (f: "narrator" | "dialogue") => void;
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PodcastPlayer({
  podcast,
  segments,
  busy,
  totalMessages,
  contactName,
  onRegenerate,
  onSetFormat,
}: PodcastPlayerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const active = segments[activeIdx];
  const totalDuration = segments.reduce((s, x) => s + (x.duration_seconds || 0), 0);

  useEffect(() => {
    setActiveIdx(0);
    setProgress(0);
    setPlaying(false);
  }, [segments.length]);

  // Auto-advance to next segment when current ends
  const handleEnded = () => {
    if (activeIdx < segments.length - 1) {
      setActiveIdx((i) => i + 1);
      setProgress(0);
      // Will autoplay via effect below
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    } else {
      setPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !active) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = v;
    setProgress(v);
  };

  // ── Empty / not-yet-generated states ──
  if (!podcast || (podcast.total_segments === 0 && totalMessages < 100)) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Mic className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
              Podcast del contacto
            </div>
            <p className="text-base text-foreground/80 mb-1">
              Se generará automáticamente cuando intercambies <span className="font-mono text-primary">100 mensajes</span> con {contactName}.
            </p>
            <p className="text-xs text-muted-foreground">
              Mensajes actuales: <span className="font-mono">{totalMessages}</span> / 100
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || totalMessages < 100}
                onClick={() => onRegenerate({})}
              >
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Generar ahora
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  const isGenerating = podcast.status === "generating" || podcast.status === "queued";

  return (
    <TooltipProvider>
      <GlassCard className="p-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              🎧 Podcast del contacto
            </div>
            <h3 className="text-lg font-semibold font-display">
              Resumen de tu relación con {contactName}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {podcast.last_message_count} mensajes cubiertos · {segments.length} segmento(s) · ~{fmtTime(totalDuration)} totales
              {podcast.last_generated_at && (
                <>
                  {" · Última actualización "}
                  {formatDistanceToNow(new Date(podcast.last_generated_at), { addSuffix: true, locale: es })}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={podcast.format}
              onValueChange={(v) => onSetFormat(v as "narrator" | "dialogue")}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="narrator">Narrador</SelectItem>
                <SelectItem value="dialogue">Diálogo (2 voces)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || isGenerating}
              onClick={() => onRegenerate({ full: true })}
            >
              {busy || isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerar
            </Button>
          </div>
        </div>

        {/* Active player */}
        {active?.signedUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                onClick={togglePlay}
                className="w-12 h-12 rounded-full"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.5}
                  value={progress}
                  onChange={onSeek}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono mt-1">
                  <span>{fmtTime(progress)}</span>
                  <span>{fmtTime(duration)}</span>
                </div>
              </div>
              <a href={active.signedUrl} download={`segmento-${active.segment_number}.mp3`}>
                <Button size="icon" variant="ghost" title="Descargar segmento">
                  <Download className="w-4 h-4" />
                </Button>
              </a>
            </div>

            <audio
              ref={audioRef}
              src={active.signedUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setProgress((e.target as HTMLAudioElement).currentTime)}
              onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
              onEnded={handleEnded}
              preload="metadata"
            />

            {/* Segment strip */}
            {segments.length > 1 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {segments.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveIdx(i);
                        setProgress(0);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-mono border transition-all",
                        i === activeIdx
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white/[0.04] border-white/10 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      Seg {s.segment_number}
                    </button>
                  ))}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-[10px] text-muted-foreground/70 cursor-help">
                      ⓘ El scrub funciona dentro de cada segmento
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Concatenación completa próximamente. Por ahora cada segmento se reproduce de forma independiente y enlaza con el siguiente automáticamente.
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        ) : isGenerating ? (
          <div className="flex items-center gap-3 text-muted-foreground py-6">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generando el podcast… puede tardar 1-2 minutos.</span>
          </div>
        ) : podcast.status === "error" ? (
          <p className="text-sm text-destructive">
            Error: {podcast.error_message || "fallo desconocido"}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No hay segmentos todavía.</p>
        )}
      </GlassCard>
    </TooltipProvider>
  );
}
