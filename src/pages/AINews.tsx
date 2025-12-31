import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  Video,
  Calendar,
  Loader2,
  Sparkles,
  Clock,
  Archive
} from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  category: string;
  is_video: boolean;
  creator_name: string | null;
  date: string;
  created_at: string;
}

const AINews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("today");

  useEffect(() => {
    fetchStoredNews();
  }, [user]);

  const fetchStoredNews = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-news', {
        body: { action: 'get' },
      });

      if (error) throw error;
      
      if (data.success) {
        setNews(data.news || []);
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
      const { data, error } = await supabase.functions.invoke('ai-news', {
        body: { action: 'fetch' },
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success(`Se encontraron ${data.news?.length || 0} noticias`);
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

  const groupedNews = useMemo(() => {
    const groups: Record<string, NewsItem[]> = {};
    
    news.forEach(item => {
      const date = item.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [news]);

  const todayNews = useMemo(() => 
    news.filter(item => isToday(parseISO(item.date))),
    [news]
  );

  const yesterdayNews = useMemo(() => 
    news.filter(item => isYesterday(parseISO(item.date))),
    [news]
  );

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    return format(date, "EEEE, d 'de' MMMM", { locale: es });
  };

  const NewsCard = ({ item }: { item: NewsItem }) => (
    <Card className="border-border bg-card hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            item.is_video ? "bg-destructive/20" : "bg-primary/20"
          )}>
            {item.is_video ? (
              <Video className="w-5 h-5 text-destructive" />
            ) : (
              <Newspaper className="w-5 h-5 text-primary" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-foreground line-clamp-2">{item.title}</h3>
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
            </div>
            
            {item.summary && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {item.summary}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {item.source_name && (
                <Badge variant="outline" className="text-xs">
                  {item.source_name}
                </Badge>
              )}
              {item.is_video && item.creator_name && (
                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                  {item.creator_name}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                <Clock className="w-3 h-3 mr-1" />
                {format(parseISO(item.created_at), "HH:mm")}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Noticias de IA</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {news.length} NOTICIAS ARCHIVADAS
                </p>
              </div>
            </div>

            <Button
              onClick={refreshNews}
              disabled={refreshing}
              className="gap-2"
            >
              {refreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Actualizar noticias
                </>
              )}
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="today" className="gap-2">
                <Calendar className="w-4 h-4" />
                Hoy ({todayNews.length})
              </TabsTrigger>
              <TabsTrigger value="yesterday" className="gap-2">
                Ayer ({yesterdayNews.length})
              </TabsTrigger>
              <TabsTrigger value="archive" className="gap-2">
                <Archive className="w-4 h-4" />
                Archivo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : todayNews.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="py-12 text-center">
                    <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay noticias de hoy</p>
                    <Button onClick={refreshNews} variant="outline" className="mt-4 gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Buscar noticias
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {todayNews.map(item => (
                    <NewsCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="yesterday" className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : yesterdayNews.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="py-12 text-center">
                    <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay noticias de ayer</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {yesterdayNews.map(item => (
                    <NewsCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="archive" className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : groupedNews.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="py-12 text-center">
                    <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay noticias archivadas</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {groupedNews.map(([date, items]) => (
                    <div key={date}>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        {formatDateLabel(date)}
                        <Badge variant="outline" className="ml-2">{items.length}</Badge>
                      </h3>
                      <div className="grid gap-4">
                        {items.map(item => (
                          <NewsCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AINews;
