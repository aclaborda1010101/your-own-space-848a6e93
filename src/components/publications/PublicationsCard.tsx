import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { useJarvisPublications, Phrase } from "@/hooks/useJarvisPublications";

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
    generateContent,
    selectPhrase,
    copyToClipboard,
    markAsPublished,
    getTodaysPublication,
  } = useJarvisPublications();

  const [selectedTab, setSelectedTab] = useState("phrases");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generando contenido...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-chart-4/10 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-chart-4" />
            </div>
            JARVIS Publicaciones
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {publication ? "Regenerar" : "Generar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!publication ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-chart-4/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 text-chart-4" />
            </div>
            <div>
              <p className="text-foreground font-medium">Genera tu contenido del día</p>
              <p className="text-sm text-muted-foreground mt-1">
                5 frases únicas, copys y hashtags listos para publicar
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
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {publication.phrases.map((phrase, i) => {
                    const config = categoryConfig[phrase.category] || categoryConfig.reflexion;
                    const isSelected = publication.selectedPhrase?.category === phrase.category;
                    
                    return (
                      <div
                        key={i}
                        className={`p-4 rounded-lg border transition-all cursor-pointer hover:border-primary/50 ${
                          isSelected ? "border-primary bg-primary/5" : "border-border"
                        }`}
                        onClick={() => selectPhrase(phrase)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className={config.color}>
                            {config.emoji} {config.label}
                          </Badge>
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
      </CardContent>
    </Card>
  );
};
