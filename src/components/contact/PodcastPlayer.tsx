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
import { GlassCard } from "@/components/ui/GlassCard";
import type { PodcastRow, PodcastSegment } from "@/hooks/useContactPodcast";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface PodcastPlayerProps {
  podcast: PodcastRow | null;
  segment: PodcastSegment | null;
  busy: boolean;
  totalMessages: number;
  contactName: string;
  onRegenerate: (opts: { format?: "narrator" | "dialogue" }) => void;
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
  segment,
  busy,
  totalMessages,
  contactName,
  onRegenerate,
  onSetFormat,
}: PodcastPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [segment?.id]);

  const togglePlay = () => {
    if (!audioRef.current || !segment) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = v;
    setProgress(v);
  };

  const isGenerating =
    podcast?.status === "generating" || podcast?.status === "queued";

  // Empty state: no podcast yet AND no messages → invite
  if (!podcast || (!segment && !isGenerating)) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Mic className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
              Podcast de la relación
            </div>
            <p className="text-base text-foreground/80 mb-1">
              Genera un audio único que resume toda tu relación con {contactName}.
            </p>
            <p className="text-xs text-muted-foreground">
              Mensajes intercambiados:{" "}
              <span className="font-mono">{totalMessages}</span>
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Select
                value={podcast?.format || "narrator"}
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
                disabled={busy || totalMessages === 0}
                onClick={() => onRegenerate({})}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4 mr-2" />
                )}
                Generar podcast
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            🎧 Podcast de la relación
          </div>
          <h3 className="text-lg font-semibold font-display">
            Resumen completo con {contactName}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {segment
              ? `${segment.message_count} mensajes cubiertos · ~${fmtTime(segment.duration_seconds)} de audio`
              : "Generando…"}
            {podcast.last_generated_at && segment && (
              <>
                {" · Generado "}
                {formatDistanceToNow(new Date(podcast.last_generated_at), {
                  addSuffix: true,
                  locale: es,
                })}
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
            onClick={() => onRegenerate({})}
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

      {segment?.signedUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              onClick={togglePlay}
              className="w-12 h-12 rounded-full"
            >
              {playing ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
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
            <a
              href={segment.signedUrl}
              download={`podcast-${contactName.replace(/\s+/g, "-").toLowerCase()}.mp3`}
            >
              <Button size="icon" variant="ghost" title="Descargar podcast">
                <Download className="w-4 h-4" />
              </Button>
            </a>
          </div>

          <audio
            ref={audioRef}
            src={segment.signedUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) =>
              setProgress((e.target as HTMLAudioElement).currentTime)
            }
            onLoadedMetadata={(e) =>
              setDuration((e.target as HTMLAudioElement).duration)
            }
            onEnded={() => setPlaying(false)}
            preload="metadata"
          />
        </div>
      ) : isGenerating ? (
        <div className="flex items-center gap-3 text-muted-foreground py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>
            Generando el podcast de toda la relación… puede tardar 1-3 minutos.
          </span>
        </div>
      ) : podcast.status === "error" ? (
        <p className="text-sm text-destructive">
          Error: {podcast.error_message || "fallo desconocido"}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No hay audio todavía.</p>
      )}
    </GlassCard>
  );
}
