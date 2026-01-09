import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Megaphone,
  RefreshCw,
  Copy,
  Check,
  Hash,
  Loader2,
  Sparkles,
  Instagram,
  Linkedin,
  Twitter,
  ChevronRight,
  Image,
  Download,
  Smartphone,
  Square,
  Calendar,
} from "lucide-react";
import { useJarvisPublications, Phrase, IMAGE_STYLES, STORY_STYLES } from "@/hooks/useJarvisPublications";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";

const categoryConfig: Record<string, { label: string; color: string; emoji: string }> = {
  inconformismo: { label: "Inconformismo", color: "bg-destructive/20 text-destructive", emoji: "🔥" },
  estoicismo: { label: "Estoicismo", color: "bg-chart-4/20 text-chart-4", emoji: "🏛️" },
  superacion: { label: "Superación", color: "bg-success/20 text-success", emoji: "🚀" },
  motivacion: { label: "Motivación", color: "bg-warning/20 text-warning", emoji: "⚡" },
  reflexion: { label: "Reflexión", color: "bg-primary/20 text-primary", emoji: "💭" },
};

export const PublicationsCard = () => {
  const {
    publication,
    loading,
    generatingImage,
    generatingStory,
    selectedStyle,
    setSelectedStyle,
    selectedStoryStyle,
    setSelectedStoryStyle,
    generateContent,
    generateImageForPhrase,
    regenerateImage,
    generateStoryImage,
    selectPhrase,
    copyToClipboard,
    markAsPublished,
    getTodaysPublication,
    downloadImage,
  } = useJarvisPublications();

  const [selectedTab, setSelectedTab] = useState("phrases");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; isStory?: boolean } | null>(null);
  const [expandedPhrase, setExpandedPhrase] = useState<number | null>(null);
  
  // Challenge day counter (starting from Jan 1, 2026)
  const [challengeDay, setChallengeDay] = useState<number>(1);
  const [challengeTotal, setChallengeTotal] = useState<number>(180);

  useEffect(() => {
    getTodaysPublication();
  }, [getTodaysPublication]);

  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = async () => {
    await generateContent();
  };

  if (loading) {
    return (
      <CollapsibleCard
        id="publications"
        title="JARVIS Publicaciones"
        icon={<Megaphone className="w-4 h-4 text-chart-4" />}
      >
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Generando contenido...</p>
        </div>
      </CollapsibleCard>
    );
  }

  const headerBadge = (
    <div className="flex items-center gap-2 ml-auto">
      <Select value={selectedStyle} onValueChange={setSelectedStyle}>
        <SelectTrigger className="w-[160px] h-8">
          <SelectValue placeholder="Estilo" />
        </SelectTrigger>
        <SelectContent>
          {IMAGE_STYLES.map((style) => (
            <SelectItem key={style.id} value={style.id}>
              {style.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleGenerate(); }} disabled={loading}>
        <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
        {publication ? "Regenerar" : "Generar"}
      </Button>
    </div>
  );

  return (
    <>
      <CollapsibleCard
        id="publications"
        title="JARVIS Publicaciones"
        icon={<Megaphone className="w-4 h-4 text-chart-4" />}
        badge={headerBadge}
      >
        <div className="p-3 sm:p-4">
          {!publication ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-chart-4/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-chart-4" />
              </div>
              <div>
                <p className="text-foreground font-medium">Genera tu contenido del día</p>
                <p className="text-sm text-muted-foreground mt-1">
                  5 frases únicas con imágenes profesionales B/N
                </p>
              </div>
              <Button onClick={handleGenerate}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generar contenido
              </Button>
            </div>
          ) : (
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-full">
                <TabsTrigger value="phrases" className="flex-1">Frases</TabsTrigger>
                <TabsTrigger value="copy" className="flex-1">Copys</TabsTrigger>
                <TabsTrigger value="hashtags" className="flex-1">Hashtags</TabsTrigger>
              </TabsList>

              <TabsContent value="phrases" className="mt-4">
                {publication.tipOfTheDay && (
                  <div className="p-3 mb-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">💡 Consejo: </span>
                      {publication.tipOfTheDay}
                    </p>
                  </div>
                )}
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {publication.phrases.map((phrase, i) => {
                      const config = categoryConfig[phrase.category] || categoryConfig.reflexion;
                      const isSelected = publication.selectedPhrase?.category === phrase.category;
                      const isExpanded = expandedPhrase === i;
                      const isGeneratingThis = generatingImage === phrase.category;
                      const isGeneratingStoryThis = generatingStory === phrase.category;
                      
                      return (
                        <div
                          key={i}
                          className={`rounded-lg border transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          {/* Header */}
                          <div 
                            className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => {
                              selectPhrase(phrase);
                              setExpandedPhrase(isExpanded ? null : i);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge variant="outline" className={config.color}>
                                {config.emoji} {config.label}
                              </Badge>
                              <div className="flex items-center gap-1">
                                {phrase.imageUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewImage({ url: phrase.imageUrl!, title: phrase.category });
                                    }}
                                  >
                                    <Square className="w-3 h-3" />
                                  </Button>
                                )}
                                {phrase.storyImageUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewImage({ url: phrase.storyImageUrl!, title: `Story ${phrase.category}`, isStory: true });
                                    }}
                                  >
                                    <Smartphone className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(phrase.text, `phrase-${i}`);
                                  }}
                                >
                                  {copiedId === `phrase-${i}` ? (
                                    <Check className="w-3 h-3 text-success" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <p className="text-foreground font-medium leading-relaxed">
                              {phrase.text}
                            </p>
                            {phrase.textLong && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {phrase.textLong}
                              </p>
                            )}
                            {phrase.cta && (
                              <p className="text-xs text-primary mt-2 flex items-center gap-1">
                                <ChevronRight className="w-3 h-3" />
                                {phrase.cta}
                              </p>
                            )}
                          </div>

                          {/* Expanded Actions */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
                              {/* Image Preview */}
                              {phrase.imageUrl && (
                                <div className="relative aspect-square max-w-[200px] rounded-lg overflow-hidden bg-muted">
                                  <img 
                                    src={phrase.imageUrl} 
                                    alt={phrase.category}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-2">
                                {/* Generate/Regenerate Square Image */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => regenerateImage(i, selectedStyle)}
                                  disabled={isGeneratingThis}
                                >
                                  {isGeneratingThis ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Image className="w-4 h-4 mr-1" />
                                  )}
                                  {phrase.imageUrl ? "Regenerar" : "Generar"} imagen
                                </Button>

                                {/* Generate Story (9:16) */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateStoryImage(i, selectedStoryStyle, challengeDay, challengeTotal)}
                                  disabled={isGeneratingStoryThis}
                                >
                                  {isGeneratingStoryThis ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Smartphone className="w-4 h-4 mr-1" />
                                  )}
                                  {phrase.storyImageUrl ? "Regenerar" : "Crear"} Story 9:16
                                </Button>

                                {/* Download buttons */}
                                {phrase.imageUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => downloadImage(phrase.imageUrl!, `jarvis-${phrase.category}-square.png`)}
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    1:1
                                  </Button>
                                )}
                                {phrase.storyImageUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => downloadImage(phrase.storyImageUrl!, `jarvis-${phrase.category}-story.png`)}
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    9:16
                                  </Button>
                                )}
                              </div>

                              {/* Style selectors */}
                              <div className="flex flex-wrap items-center gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Imagen:</span>
                                  <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                                    <SelectTrigger className="w-[140px] h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {IMAGE_STYLES.map((style) => (
                                        <SelectItem key={style.id} value={style.id}>
                                          {style.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Story:</span>
                                  <Select value={selectedStoryStyle} onValueChange={setSelectedStoryStyle}>
                                    <SelectTrigger className="w-[150px] h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STORY_STYLES.map((style) => (
                                        <SelectItem key={style.id} value={style.id}>
                                          {style.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Challenge day counter */}
                              <div className="flex items-center gap-3 text-sm pt-2 border-t border-border/50">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Día del reto:</span>
                                <Input
                                  type="number"
                                  min={1}
                                  max={challengeTotal}
                                  value={challengeDay}
                                  onChange={(e) => setChallengeDay(parseInt(e.target.value) || 1)}
                                  className="w-16 h-7 text-xs"
                                />
                                <span className="text-muted-foreground">/</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={challengeTotal}
                                  onChange={(e) => setChallengeTotal(parseInt(e.target.value) || 180)}
                                  className="w-16 h-7 text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="copy" className="mt-4 space-y-4">
                {/* Short Copy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">Copy Corto (Story/Tweet)</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleCopy(publication.copyShort, "copy-short")}
                    >
                      {copiedId === "copy-short" ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {publication.copyShort}
                    </p>
                  </div>
                </div>

                {/* Long Copy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">Copy Largo (Post Feed)</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleCopy(publication.copyLong, "copy-long")}
                    >
                      {copiedId === "copy-long" ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {publication.copyLong}
                    </p>
                  </div>
                </div>

                {/* Mark as Published */}
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Marcar como publicado en:</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsPublished("instagram")}
                      disabled={publication.published}
                    >
                      <Instagram className="w-4 h-4 mr-1" />
                      Instagram
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsPublished("linkedin")}
                      disabled={publication.published}
                    >
                      <Linkedin className="w-4 h-4 mr-1" />
                      LinkedIn
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsPublished("twitter")}
                      disabled={publication.published}
                    >
                      <Twitter className="w-4 h-4 mr-1" />
                      Twitter
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="hashtags" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      Hashtags ({publication.hashtags.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleCopy(publication.hashtags.map(h => `#${h}`).join(" "), "hashtags")}
                    >
                      {copiedId === "hashtags" ? (
                        <>
                          <Check className="w-3 h-3 text-success mr-1" />
                          Copiados
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copiar todos
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {publication.hashtags.map((tag, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => handleCopy(`#${tag}`, `tag-${i}`)}
                      >
                        #{tag}
                        {copiedId === `tag-${i}` && (
                          <Check className="w-3 h-3 ml-1 text-success" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </CollapsibleCard>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className={previewImage?.isStory ? "max-w-sm" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <div className={`rounded-lg overflow-hidden bg-muted ${previewImage.isStory ? "aspect-[9/16]" : "aspect-square"}`}>
                <img 
                  src={previewImage.url} 
                  alt={previewImage.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => downloadImage(previewImage.url, `jarvis-${previewImage.title}.png`)}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar imagen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
