import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  Newspaper, RefreshCw, ExternalLink, Calendar, Loader2, Sparkles, Clock, Archive,
  Youtube, Play, TrendingUp, Star, Bell, BellOff, FileText, Lightbulb, BookmarkCheck,
  Users, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { ContentCreatorsSection } from "@/components/ai-news/ContentCreatorsSection";

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  category: string;
  is_video: boolean;
  creator_name: string | null;
  relevance_score: number | null;
  date: string;
  created_at: string;
  isFavorite?: boolean;
}

interface DailySummary {
  id: string;
  summary: string;
  key_insights: string[];
  generated_at: string;
}

interface VideoAlert {
  id: string;
  creator_name: string;
  enabled: boolean;
}

const AI_CREATORS = [
  "Carlos Santana", "Jon Hernández", "Romuald Fons", "Miguel Baena",
  "Xavier Mitjana", "Sergio Señor", "Tu Profe de IA", "NextGen IA",
];

const AINews = () => {
  const { user } = useAuth();
  
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("today");
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [videoAlerts, setVideoAlerts] = useState<VideoAlert[]>([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => { fetchStoredNews(); }, [user]);

  const fetchStoredNews = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-news', { body: { action: 'get' } });
      if (error) throw error;
      if (data.success) {
        setNews(data.news || []);
        setDailySummary(data.summary || null);
        setVideoAlerts(data.videoAlerts || []);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error('Error al cargar las noticias');
    } finally {
      setLoading(false);
    }
  };

  const refreshNews = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-news', { body: { action: 'fetch' } });
      if (error) throw error;
      if (data.success) {
        toast.success(`Se encontraron ${data.totalItems || 0} noticias`);
        await fetchStoredNews();
      } else {
        toast.error(data.error || 'Error al actualizar noticias');
      }
    } catch (error) {
      console.error('Error refreshing news:', error);
      toast.error('Error al actualizar las noticias');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleFavorite = async (newsId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-news', { body: { action: 'toggle-favorite', newsId } });
      if (error) throw error;
      setNews(prev => prev.map(item => item.id === newsId ? { ...item, isFavorite: data.isFavorite } : item));
      toast.success(data.isFavorite ? 'Añadido a favoritos' : 'Eliminado de favoritos');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Error al guardar favorito');
    }
  };

  const generateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-news', { body: { action: 'generate-summary' } });
      if (error) throw error;
      if (data.success) {
        setDailySummary({ id: 'new', summary: data.summary, key_insights: data.key_insights, generated_at: new Date().toISOString() });
        toast.success('Resumen generado');
      } else {
        toast.error(data.error || 'Error al generar resumen');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Error al generar resumen');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const toggleVideoAlert = async (creatorName: string, enabled: boolean) => {
    try {
      await supabase.functions.invoke('ai-news', { body: { action: 'toggle-video-alert', creatorName, enabled } });
      setVideoAlerts(prev => {
        const existing = prev.find(a => a.creator_name === creatorName);
        if (existing) return prev.map(a => a.creator_name === creatorName ? { ...a, enabled } : a);
        return [...prev, { id: 'new', creator_name: creatorName, enabled }];
      });
      toast.success(enabled ? `Alertas activadas para ${creatorName}` : `Alertas desactivadas`);
    } catch (error) {
      console.error('Error toggling video alert:', error);
    }
  };

  const groupedNews = useMemo(() => {
    const groups: Record<string, NewsItem[]> = {};
    news.forEach(item => { if (!groups[item.date]) groups[item.date] = []; groups[item.date].push(item); });
    return Object.entries(groups).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [news]);

  const todayNews = useMemo(() => news.filter(item => isToday(parseISO(item.date)) && !item.is_video), [news]);
  const todayVideos = useMemo(() => news.filter(item => isToday(parseISO(item.date)) && item.is_video), [news]);
  const yesterdayNews = useMemo(() => news.filter(item => isYesterday(parseISO(item.date)) && !item.is_video), [news]);
  const yesterdayVideos = useMemo(() => news.filter(item => isYesterday(parseISO(item.date)) && item.is_video), [news]);
  const allVideos = useMemo(() => news.filter(item => item.is_video).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [news]);
  const favorites = useMemo(() => news.filter(item => item.isFavorite), [news]);

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    return format(date, "EEEE, d 'de' MMMM", { locale: es });
  };

  const isAlertEnabled = (creatorName: string) => {
    const alert = videoAlerts.find(a => a.creator_name === creatorName);
    return alert?.enabled ?? false;
  };

  const NewsCard = ({ item }: { item: NewsItem }) => (
    <Card className="border-border bg-card hover:border-primary/30 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", item.is_video ? "bg-destructive/20" : "bg-primary/20")}>
            {item.is_video ? <Play className="w-5 h-5 text-destructive" /> : <Newspaper className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} className={cn("p-1.5 rounded-lg transition-colors", item.isFavorite ? "text-warning bg-warning/10" : "text-muted-foreground hover:bg-muted")}>
                  <Star className={cn("w-4 h-4", item.isFavorite && "fill-current")} />
                </button>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                )}
              </div>
            </div>
            {item.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {item.source_name && <Badge variant="outline" className="text-xs">{item.source_name}</Badge>}
              {item.creator_name && <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30"><Youtube className="w-3 h-3 mr-1" />{item.creator_name}</Badge>}
              {item.relevance_score && item.relevance_score >= 8 && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30"><TrendingUp className="w-3 h-3 mr-1" />Top</Badge>}
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{format(parseISO(item.created_at), "HH:mm")}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const VideoCard = ({ item }: { item: NewsItem }) => (
    <a href={item.source_url || '#'} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="border-border bg-card hover:border-destructive/50 transition-all group cursor-pointer overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-0">
            <div className="w-32 h-20 bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center flex-shrink-0 relative">
              <div className="w-10 h-10 rounded-full bg-destructive/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
              </div>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id); }} className={cn("absolute top-1 right-1 p-1 rounded transition-colors", item.isFavorite ? "text-warning" : "text-white/60 hover:text-white")}>
                <Star className={cn("w-4 h-4", item.isFavorite && "fill-current")} />
              </button>
            </div>
            <div className="flex-1 p-3 min-w-0">
              <h3 className="font-medium text-foreground line-clamp-2 text-sm group-hover:text-destructive transition-colors">{item.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                {item.creator_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><Youtube className="w-3 h-3 text-destructive" />{item.creator_name}</span>}
                <span className="text-xs text-muted-foreground">{formatDateLabel(item.date)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );

  return (
    <main className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Noticias de IA</h1>
            <p className="text-sm text-muted-foreground font-mono">{news.length} NOTICIAS · {favorites.length} FAVORITOS</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateSummary} disabled={generatingSummary || todayNews.length === 0} variant="outline" className="gap-2">
            {generatingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Resumen IA
          </Button>
          <Button onClick={refreshNews} disabled={refreshing} className="gap-2">
            {refreshing ? (<><Loader2 className="w-4 h-4 animate-spin" />Buscando...</>) : (<><RefreshCw className="w-4 h-4" />Actualizar</>)}
          </Button>
        </div>
      </div>

      {dailySummary && (
        <Collapsible defaultOpen={false}>
          <Card className="border-primary/30 bg-primary/5">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-primary/10 transition-colors rounded-t-lg">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Resumen del día
                  <Badge variant="outline" className="text-xs">{format(parseISO(dailySummary.generated_at), "HH:mm")}</Badge>
                  <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                <p className="text-sm text-foreground">{dailySummary.summary}</p>
                {dailySummary.key_insights && dailySummary.key_insights.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Puntos clave:</p>
                    <ul className="space-y-1">
                      {dailySummary.key_insights.map((insight, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2"><span className="text-primary">•</span>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="today" className="gap-1 text-xs sm:text-sm"><Calendar className="w-4 h-4" /><span className="hidden sm:inline">Hoy</span></TabsTrigger>
          <TabsTrigger value="videos" className="gap-1 text-xs sm:text-sm"><Youtube className="w-4 h-4" /><span className="hidden sm:inline">Videos</span></TabsTrigger>
          <TabsTrigger value="creators" className="gap-1 text-xs sm:text-sm"><Users className="w-4 h-4" /><span className="hidden sm:inline">Creadores</span></TabsTrigger>
          <TabsTrigger value="favorites" className="gap-1 text-xs sm:text-sm"><Star className="w-4 h-4" /><span className="hidden sm:inline">Guardados</span>{favorites.length > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{favorites.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1 text-xs sm:text-sm"><Bell className="w-4 h-4" /><span className="hidden sm:inline">Alertas</span></TabsTrigger>
          <TabsTrigger value="archive" className="gap-1 text-xs sm:text-sm"><Archive className="w-4 h-4" /><span className="hidden sm:inline">Archivo</span></TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : todayNews.length === 0 && todayVideos.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center"><Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">No hay noticias de hoy</p><Button className="mt-4" onClick={refreshNews} disabled={refreshing}><RefreshCw className="w-4 h-4 mr-2" />Buscar noticias</Button></CardContent></Card>
          ) : (
            <>
              {todayVideos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Youtube className="w-5 h-5 text-destructive" />Videos de hoy ({todayVideos.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{todayVideos.map(item => <VideoCard key={item.id} item={item} />)}</div>
                </div>
              )}
              {todayNews.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Newspaper className="w-5 h-5 text-primary" />Noticias de hoy ({todayNews.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{todayNews.map(item => <NewsCard key={item.id} item={item} />)}</div>
                </div>
              )}
              {yesterdayVideos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Youtube className="w-5 h-5 text-destructive" />Videos de ayer ({yesterdayVideos.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{yesterdayVideos.map(item => <VideoCard key={item.id} item={item} />)}</div>
                </div>
              )}
              {yesterdayNews.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Newspaper className="w-5 h-5 text-primary" />Noticias de ayer ({yesterdayNews.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{yesterdayNews.map(item => <NewsCard key={item.id} item={item} />)}</div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-4 mt-4">
          {allVideos.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center"><Youtube className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">No hay videos</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{allVideos.map(item => <VideoCard key={item.id} item={item} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="creators" className="mt-4">
          <ContentCreatorsSection />
        </TabsContent>

        <TabsContent value="favorites" className="space-y-4 mt-4">
          {favorites.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center"><BookmarkCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">No hay favoritos guardados</p><p className="text-xs text-muted-foreground mt-1">Marca noticias con ⭐ para guardarlas aquí</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{favorites.map(item => item.is_video ? <VideoCard key={item.id} item={item} /> : <NewsCard key={item.id} item={item} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Alertas de videos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Activa alertas para recibir notificaciones cuando publiquen nuevos videos.</p>
              {AI_CREATORS.map(creator => (
                <div key={creator} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Youtube className="w-5 h-5 text-destructive" />
                    <span className="font-medium text-sm">{creator}</span>
                  </div>
                  <Switch checked={isAlertEnabled(creator)} onCheckedChange={(checked) => toggleVideoAlert(creator, checked)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive" className="space-y-6 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : groupedNews.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center"><Archive className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">No hay archivo</p></CardContent></Card>
          ) : (
            <div className="space-y-8">
              {groupedNews.map(([date, items]) => (
                <div key={date}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" />{formatDateLabel(date)}<Badge variant="outline" className="text-xs">{items.length}</Badge></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(item => item.is_video ? <VideoCard key={item.id} item={item} /> : <NewsCard key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default AINews;
