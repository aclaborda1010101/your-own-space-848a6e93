import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useJarvisPublications, Phrase } from "@/hooks/useJarvisPublications";
import { useSidebarState } from "@/hooks/useSidebarState";
import { 
  Calendar, 
  History, 
  Sparkles, 
  Check, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Instagram,
  Linkedin,
  Twitter,
  Copy,
  Eye
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PublicationRecord {
  id: string;
  date: string;
  phrases: Phrase[];
  selected_phrase: Phrase | null;
  copy_short: string | null;
  copy_long: string | null;
  hashtags: string[] | null;
  published: boolean;
  published_at: string | null;
  platform: string | null;
}

const Publications = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [selectedPublication, setSelectedPublication] = useState<PublicationRecord | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { user } = useAuth();
  const { copyToClipboard } = useJarvisPublications();

  useEffect(() => {
    if (user) {
      fetchPublications();
    }
  }, [user]);

  const fetchPublications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('daily_publications')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (!error && data) {
      setPublications(data.map(d => ({
        ...d,
        phrases: d.phrases as unknown as Phrase[],
        selected_phrase: d.selected_phrase as unknown as Phrase | null,
      })));
    }
  };

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getPublicationForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return publications.find(p => p.date === dateStr);
  };

  const publishedCount = publications.filter(p => p.published).length;
  const pendingCount = publications.filter(p => !p.published).length;

  const getPlatformIcon = (platform: string | null) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      case 'twitter': return <Twitter className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleDayClick = (day: Date) => {
    const pub = getPublicationForDay(day);
    if (pub) {
      setSelectedPublication(pub);
      setViewDialogOpen(true);
    }
  };

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
        
        <main className="p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                JARVIS Publicaciones
              </h1>
              <p className="text-muted-foreground">
                Calendario editorial y gestión de contenido
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{publications.length}</p>
                  <p className="text-xs text-muted-foreground">Total generadas</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{publishedCount}</p>
                  <p className="text-xs text-muted-foreground">Publicadas</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {publications.length > 0 ? Math.round(publishedCount / publications.length * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Tasa publicación</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="calendar" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="w-4 h-4" />
                Calendario
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                Historial
              </TabsTrigger>
            </TabsList>

            {/* Calendar View */}
            <TabsContent value="calendar">
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Calendario Editorial</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-32 text-center capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for days before month start */}
                    {Array.from({ length: (monthDays[0].getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    
                    {monthDays.map(day => {
                      const pub = getPublicationForDay(day);
                      const hasContent = !!pub;
                      const isPublished = pub?.published;
                      
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => handleDayClick(day)}
                          disabled={!hasContent}
                          className={cn(
                            "aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-sm transition-all relative",
                            isToday(day) && "ring-2 ring-primary",
                            hasContent && !isPublished && "bg-warning/20 hover:bg-warning/30 cursor-pointer",
                            hasContent && isPublished && "bg-success/20 hover:bg-success/30 cursor-pointer",
                            !hasContent && "bg-muted/30 text-muted-foreground",
                            !isSameMonth(day, currentMonth) && "opacity-50"
                          )}
                        >
                          <span className={cn(
                            "font-medium",
                            isToday(day) && "text-primary"
                          )}>
                            {format(day, 'd')}
                          </span>
                          {hasContent && (
                            <div className="flex gap-0.5">
                              {isPublished ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Clock className="w-3 h-3 text-warning" />
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-success/30" />
                      <span>Publicado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-warning/30" />
                      <span>Pendiente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-muted/50" />
                      <span>Sin contenido</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History View */}
            <TabsContent value="history">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Historial de Publicaciones</CardTitle>
                  <CardDescription>Todas las publicaciones generadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {publications.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay publicaciones aún</p>
                        <p className="text-sm">Genera contenido desde el Dashboard</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {publications.map(pub => (
                          <div
                            key={pub.id}
                            className="p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium">
                                    {format(new Date(pub.date), "d 'de' MMMM, yyyy", { locale: es })}
                                  </span>
                                  {pub.published ? (
                                    <Badge variant="secondary" className="bg-success/20 text-success border-success/30">
                                      {getPlatformIcon(pub.platform)}
                                      <span className="ml-1">Publicado</span>
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
                                      Pendiente
                                    </Badge>
                                  )}
                                </div>
                                
                                {pub.selected_phrase && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                    "{pub.selected_phrase.text}"
                                  </p>
                                )}
                                
                                <div className="flex flex-wrap gap-1">
                                  {pub.phrases.slice(0, 3).map((phrase, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {phrase.category}
                                    </Badge>
                                  ))}
                                  {pub.phrases.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{pub.phrases.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPublication(pub);
                                  setViewDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* View Publication Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Publicación del {selectedPublication && format(new Date(selectedPublication.date), "d 'de' MMMM", { locale: es })}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPublication && (
            <div className="space-y-6">
              {/* Phrases */}
              <div>
                <h4 className="text-sm font-medium mb-3">Frases Generadas</h4>
                <div className="space-y-2">
                  {selectedPublication.phrases.map((phrase, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {phrase.category}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(phrase.text, "Frase")}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm">{phrase.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copies */}
              {(selectedPublication.copy_short || selectedPublication.copy_long) && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Copys</h4>
                  <div className="space-y-3">
                    {selectedPublication.copy_short && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Copy Corto</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedPublication.copy_short!, "Copy")}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm">{selectedPublication.copy_short}</p>
                      </div>
                    )}
                    {selectedPublication.copy_long && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Copy Largo</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedPublication.copy_long!, "Copy")}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-line">{selectedPublication.copy_long}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {selectedPublication.hashtags && selectedPublication.hashtags.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Hashtags</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedPublication.hashtags!.join(' '), "Hashtags")}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar todos
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPublication.hashtags.map((tag, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary/20"
                        onClick={() => copyToClipboard(tag, "Hashtag")}
                      >
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="pt-4 border-t border-border/50">
                {selectedPublication.published ? (
                  <div className="flex items-center gap-2 text-success">
                    <Check className="w-4 h-4" />
                    <span className="text-sm">
                      Publicado en {selectedPublication.platform}
                      {selectedPublication.published_at && (
                        <span className="text-muted-foreground ml-1">
                          · {format(new Date(selectedPublication.published_at), "HH:mm", { locale: es })}
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-warning">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pendiente de publicar</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Publications;
