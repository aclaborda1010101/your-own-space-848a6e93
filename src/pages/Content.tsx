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
import { useJarvisPublications, Phrase, IMAGE_STYLES, STORY_STYLES } from "@/hooks/useJarvisPublications";
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
  Eye,
  RefreshCw,
  BookOpen,
  Save,
  Image,
  Download,
  Palette,
  Smartphone,
  Heart,
  BookMarked,
  Sliders,
  Pencil,
  CloudOff,
  Cloud,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  Tag,
  Play
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  const [expandedPhrase, setExpandedPhrase] = useState<number | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{url: string; category: string} | null>(null);
  
  // Story overlay data
  const [storyTime, setStoryTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [challengeDay, setChallengeDay] = useState("1");
  const [challengeTotal, setChallengeTotal] = useState("180");
  
  // Content generation options
  const [selectedTone, setSelectedTone] = useState("autentico");
  const [customImageStyle, setCustomImageStyle] = useState("");
  const [personalContext, setPersonalContext] = useState("");
  
  // Edit phrase dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedTextLong, setEditedTextLong] = useState("");
  const [editedCta, setEditedCta] = useState("");
  
  // Content bank
  const [contentBank, setContentBank] = useState<any[]>([]);
  const [showContentBank, setShowContentBank] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [bankCategoryFilter, setBankCategoryFilter] = useState("all");
  
  // Save with tags dialog
  const [saveTagsDialogOpen, setSaveTagsDialogOpen] = useState(false);
  const [phraseToSave, setPhraseToSave] = useState<Phrase | null>(null);
  const [saveTags, setSaveTags] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  
  // Use from bank for story
  const [selectedBankItem, setSelectedBankItem] = useState<any | null>(null);
  
  const { user } = useAuth();
  const { 
    publication,
    setPublication,
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
    generateAllImages,
    generateStoryImage,
    shareToInstagram,
    selectPhrase, 
    savePublication, 
    markAsPublished, 
    copyToClipboard,
    getTodaysPublication,
    downloadImage 
  } = useJarvisPublications();

  useEffect(() => {
    if (user) {
      fetchPublications();
      getTodaysPublication();
      fetchContentBank();
    }
  }, [user, getTodaysPublication]);

  const fetchContentBank = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('content_bank')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setContentBank(data);
    }
  };

  // Open save dialog with tags
  const openSaveDialog = (phrase: Phrase) => {
    setPhraseToSave(phrase);
    setSaveTags("");
    setSaveNotes("");
    setSaveTagsDialogOpen(true);
  };

  const saveToContentBank = async () => {
    if (!user || !phraseToSave) return;
    
    const tagsArray = saveTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    const { error } = await supabase
      .from('content_bank')
      .insert({
        user_id: user.id,
        phrase_text: phraseToSave.text,
        reflection: phraseToSave.textLong,
        category: phraseToSave.category,
        cta: phraseToSave.cta || null,
        image_url: phraseToSave.imageUrl || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        notes: saveNotes || null,
      });
    
    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Guardado en banco de contenido");
      fetchContentBank();
      setSaveTagsDialogOpen(false);
      setPhraseToSave(null);
    }
  };

  const deleteFromContentBank = async (id: string) => {
    const { error } = await supabase
      .from('content_bank')
      .delete()
      .eq('id', id);
    
    if (!error) {
      toast.success("Eliminado del banco");
      fetchContentBank();
    }
  };

  // Export functions
  const exportToJSON = () => {
    const dataToExport = filteredContentBank.map(item => ({
      phrase: item.phrase_text,
      reflection: item.reflection,
      category: item.category,
      cta: item.cta,
      tags: item.tags,
      notes: item.notes,
      timesUsed: item.times_used,
      createdAt: item.created_at,
    }));
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `banco-contenido-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exportado a JSON");
  };

  const exportToCSV = () => {
    const headers = ['Frase', 'Reflexión', 'Categoría', 'CTA', 'Tags', 'Notas', 'Veces usado', 'Fecha'];
    const rows = filteredContentBank.map(item => [
      `"${(item.phrase_text || '').replace(/"/g, '""')}"`,
      `"${(item.reflection || '').replace(/"/g, '""')}"`,
      item.category || '',
      `"${(item.cta || '').replace(/"/g, '""')}"`,
      (item.tags || []).join('; '),
      `"${(item.notes || '').replace(/"/g, '""')}"`,
      item.times_used || 0,
      item.created_at?.split('T')[0] || '',
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `banco-contenido-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exportado a CSV");
  };

  // Generate story from bank item
  const generateStoryFromBank = async (item: any) => {
    if (!publication) {
      toast.error("Genera contenido primero para usar esta función");
      return;
    }
    
    // Create a temporary phrase object from bank item
    const tempPhrase: Phrase = {
      category: item.category || "reflexion",
      text: item.phrase_text,
      textLong: item.reflection,
      cta: item.cta,
      imageUrl: item.image_url,
    };
    
    // Find index or use first available
    const phraseIndex = 0;
    
    // Generate story with the bank item data
    await generateStoryImage(
      phraseIndex,
      selectedStoryStyle,
      parseInt(challengeDay) || 1,
      parseInt(challengeTotal) || 180
    );
    
    // Mark as used
    await supabase
      .from('content_bank')
      .update({ times_used: (item.times_used || 0) + 1 })
      .eq('id', item.id);
    
    fetchContentBank();
    toast.success("Story generada desde el banco");
  };

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

  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);

  const handleGenerate = async () => {
    // If there's existing content, ask for confirmation first
    if (publication && publication.phrases.length > 0) {
      setConfirmRegenerateOpen(true);
      return;
    }
    await doGenerate();
  };

  const doGenerate = async () => {
    setConfirmRegenerateOpen(false);
    await generateContent({ 
      tone: selectedTone,
      customImageStyle: customImageStyle || undefined,
      personalContext: personalContext || undefined
    });
    fetchPublications();
  };

  // Edit phrase functions
  const openEditDialog = (idx: number, phrase: Phrase) => {
    setEditingPhraseIndex(idx);
    setEditedText(phrase.text);
    setEditedTextLong(phrase.textLong);
    setEditedCta(phrase.cta || "");
    setEditDialogOpen(true);
  };

  const saveEditedPhrase = async () => {
    if (editingPhraseIndex === null || !publication) return;
    
    const updatedPhrases = [...publication.phrases];
    updatedPhrases[editingPhraseIndex] = {
      ...updatedPhrases[editingPhraseIndex],
      text: editedText,
      textLong: editedTextLong,
      cta: editedCta
    };
    
    // Update local state
    setPublication({ ...publication, phrases: updatedPhrases });
    
    // Save to database
    if (publication.id) {
      await supabase
        .from('daily_publications')
        .update({ phrases: updatedPhrases as never })
        .eq('id', publication.id);
    }
    
    setEditDialogOpen(false);
    setEditingPhraseIndex(null);
    toast.success("Reflexión actualizada");
  };

  // Filter content bank
  const filteredContentBank = useMemo(() => {
    return contentBank.filter(item => {
      const matchesSearch = bankSearchQuery === "" || 
        item.phrase_text?.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
        item.reflection?.toLowerCase().includes(bankSearchQuery.toLowerCase());
      
      const matchesCategory = bankCategoryFilter === "all" || 
        item.category?.toLowerCase() === bankCategoryFilter.toLowerCase();
      
      return matchesSearch && matchesCategory;
    });
  }, [contentBank, bankSearchQuery, bankCategoryFilter]);

  // Get unique categories from content bank
  const bankCategories = useMemo(() => {
    const categories = new Set(contentBank.map(item => item.category).filter(Boolean));
    return Array.from(categories);
  }, [contentBank]);

  const handleSave = async () => {
    await savePublication();
    fetchPublications();
  };

  const handleMarkPublished = async (platform: string) => {
    await markAsPublished(platform);
    fetchPublications();
  };

  const getCategoryStyle = (category: string) => {
    switch (category.toLowerCase()) {
      case 'estoicismo':
      case 'estoico':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'motivacion':
      case 'motivacional':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'superacion':
      case 'crecimiento':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'reflexion':
      case 'divulgadores':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'inconformismo':
      case 'inconformista':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
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
                Frases diarias únicas que nunca se repiten
              </p>
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? "Generando..." : "Generar contenido"}
            </Button>
          </div>

          <Tabs defaultValue="today" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="today" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Hoy
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-2">
                <BookMarked className="w-4 h-4" />
                Banco
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="w-4 h-4" />
                Calendario
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                Historial
              </TabsTrigger>
            </TabsList>

            {/* Today's Content */}
            <TabsContent value="today" className="space-y-6">
              {!publication ? (
                <Card className="bg-card/50 border-border/50">
                  <CardContent className="py-12 text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No hay contenido para hoy
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Genera frases únicas para publicar en redes sociales
                    </p>
                    <Button onClick={handleGenerate} disabled={loading} className="gap-2">
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generar contenido del día
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Saved Indicator */}
                  {publication.id && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <Cloud className="w-4 h-4" />
                      <span>Contenido guardado en la base de datos</span>
                    </div>
                  )}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-primary" />
                        <CardTitle className="text-base">Opciones de Generación</CardTitle>
                      </div>
                      <CardDescription>Personaliza el tono y estilo del contenido</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Tone Selector */}
                      <div className="space-y-2">
                        <Label className="text-sm">Tono de las reflexiones</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "vulnerable", label: "Vulnerable", desc: "Personal, íntimo" },
                            { id: "autentico", label: "Auténtico", desc: "Equilibrado" },
                            { id: "fuerte", label: "Fuerte", desc: "Directo, contundente" },
                            { id: "reflexivo", label: "Reflexivo", desc: "Profundo, filosófico" },
                          ].map((tone) => (
                            <Button
                              key={tone.id}
                              variant={selectedTone === tone.id ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedTone(tone.id)}
                              className="flex-col h-auto py-2"
                            >
                              <span>{tone.label}</span>
                              <span className="text-[10px] opacity-70">{tone.desc}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Personal Context */}
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Contexto personal real (el AI usará esto)
                        </Label>
                        <Textarea
                          placeholder="Escribe situaciones reales de tu vida: proyectos actuales, logros recientes, retos que estás enfrentando, conversaciones que has tenido, decisiones que has tomado... El AI usará esto como base para las reflexiones en lugar de inventar."
                          value={personalContext}
                          onChange={(e) => setPersonalContext(e.target.value)}
                          className="h-32 text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Cuanto más contexto real des, más auténticas serán las reflexiones generadas.
                        </p>
                      </div>
                      
                      {/* Custom Image Style */}
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                          <Pencil className="w-4 h-4" />
                          Estilo visual personalizado (opcional)
                        </Label>
                        <Textarea
                          placeholder="Describe el estilo visual que quieres: ej. 'fotografía minimalista con tonos tierra', 'ilustración digital futurista', 'collage vintage con texturas'..."
                          value={customImageStyle}
                          onChange={(e) => setCustomImageStyle(e.target.value)}
                          className="h-20 text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Style Selector and Generate All Images */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-primary" />
                        <CardTitle className="text-base">Estilo Visual Predefinido</CardTitle>
                      </div>
                      <CardDescription>O elige un estilo predefinido para las imágenes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {IMAGE_STYLES.map((style) => (
                          <Button
                            key={style.id}
                            variant={selectedStyle === style.id && !customImageStyle ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setSelectedStyle(style.id);
                              setCustomImageStyle("");
                            }}
                            className={cn(
                              "transition-all",
                              selectedStyle === style.id && !customImageStyle && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            )}
                          >
                            {style.name}
                          </Button>
                        ))}
                      </div>
                      
                      {publication.phrases.some(p => !p.imageUrl) && (
                        <Button 
                          onClick={generateAllImages} 
                          variant="secondary" 
                          className="w-full gap-2"
                          disabled={!!generatingImage}
                        >
                          {generatingImage ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Image className="w-4 h-4" />
                          )}
                          {generatingImage ? `Generando ${generatingImage}...` : "Generar todas las imágenes"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Phrases Grid */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {publication.phrases.map((phrase, idx) => (
                      <Card 
                        key={idx} 
                        className={cn(
                          "bg-card/50 border-border/50 transition-all cursor-pointer hover:border-primary/50 overflow-hidden",
                          publication.selectedPhrase?.category === phrase.category && "ring-2 ring-primary"
                        )}
                        onClick={() => selectPhrase(phrase)}
                      >
                        {/* Image Section */}
                        <div className="relative aspect-square bg-muted/30">
                          {phrase.imageUrl ? (
                            <>
                              <img 
                                src={phrase.imageUrl} 
                                alt={phrase.category}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedImage({ url: phrase.imageUrl!, category: phrase.category });
                                  setImageDialogOpen(true);
                                }}
                              />
                              <Button
                                variant="secondary"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement('a');
                                  link.href = phrase.imageUrl!;
                                  link.download = `${phrase.category}-${new Date().toISOString().split('T')[0]}.png`;
                                  link.click();
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </>
                          ) : generatingImage === phrase.category ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                              <span className="text-sm text-muted-foreground">Generando imagen...</span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                              <Image className="w-12 h-12 text-muted-foreground/30" />
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateImageForPhrase(idx);
                                }}
                              >
                                <Sparkles className="w-4 h-4" />
                                Generar imagen
                              </Button>
                            </div>
                          )}
                        </div>

                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge className={cn("capitalize", getCategoryStyle(phrase.category))}>
                              {phrase.category}
                            </Badge>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(idx, phrase);
                                }}
                                title="Editar reflexión"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSaveDialog(phrase);
                                }}
                                title="Guardar en banco"
                              >
                                <Heart className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(phrase.text, "Frase");
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-foreground font-medium leading-relaxed mb-3 text-sm">
                            "{phrase.text}"
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full gap-2 text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPhrase(expandedPhrase === idx ? null : idx);
                            }}
                          >
                            <BookOpen className="w-4 h-4" />
                            {expandedPhrase === idx ? "Ocultar reflexión" : "Ver reflexión"}
                          </Button>
                          
                          {expandedPhrase === idx && (
                            <div className="mt-3 space-y-3">
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {phrase.textLong}
                                </p>
                                {phrase.cta && (
                                  <p className="text-sm text-primary mt-2 font-medium">
                                    → {phrase.cta}
                                  </p>
                                )}
                              </div>
                              
                              {/* Story and Image Actions */}
                              <div className="space-y-3">
                                {/* Story Overlay Config */}
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                                  <p className="text-xs font-medium text-muted-foreground">Datos para Story</p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Hora</Label>
                                      <Input
                                        type="time"
                                        value={storyTime}
                                        onChange={(e) => setStoryTime(e.target.value)}
                                        className="h-8 text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Día del reto</Label>
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          min="1"
                                          max="999"
                                          value={challengeDay}
                                          onChange={(e) => setChallengeDay(e.target.value)}
                                          className="h-8 text-sm w-16"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-muted-foreground">/</span>
                                        <Input
                                          type="number"
                                          min="1"
                                          max="999"
                                          value={challengeTotal}
                                          onChange={(e) => setChallengeTotal(e.target.value)}
                                          className="h-8 text-sm w-16"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Story Style Selector */}
                                <div className="flex flex-wrap gap-2 items-center">
                                  <span className="text-xs text-muted-foreground">Estilo Story:</span>
                                  {STORY_STYLES.map((style) => (
                                    <Button
                                      key={style.id}
                                      variant={selectedStoryStyle === style.id ? "default" : "outline"}
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedStoryStyle(style.id);
                                      }}
                                    >
                                      {style.name}
                                    </Button>
                                  ))}
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                  {phrase.imageUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        regenerateImage(idx, selectedStyle, customImageStyle || undefined);
                                      }}
                                      disabled={generatingImage === phrase.category}
                                    >
                                      {generatingImage === phrase.category ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="w-4 h-4" />
                                      )}
                                      Regenerar imagen
                                    </Button>
                                  )}
                                  
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="gap-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateStoryImage(
                                        idx, 
                                        selectedStoryStyle, 
                                        parseInt(challengeDay) || 1, 
                                        parseInt(challengeTotal) || 180,
                                        storyTime
                                      );
                                    }}
                                    disabled={generatingStory === phrase.category}
                                  >
                                    {generatingStory === phrase.category ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Smartphone className="w-4 h-4" />
                                    )}
                                    {phrase.storyImageUrl ? "Regenerar" : "Crear"} Story 9:16
                                  </Button>
                                  
                                  {phrase.storyImageUrl && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedImage({ url: phrase.storyImageUrl!, category: `Story ${phrase.category}` });
                                          setImageDialogOpen(true);
                                        }}
                                      >
                                        <Eye className="w-4 h-4" />
                                        Ver Story
                                      </Button>
                                      
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadImage(phrase.storyImageUrl!, `story-${phrase.category}-${new Date().toISOString().split('T')[0]}.png`);
                                        }}
                                      >
                                        <Download className="w-4 h-4" />
                                        Descargar
                                      </Button>
                                      
                                      <Button
                                        size="sm"
                                        className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          shareToInstagram(phrase.storyImageUrl!);
                                        }}
                                      >
                                        <Instagram className="w-4 h-4" />
                                        Publicar en IG
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Copies and Hashtags */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Copy Short */}
                    {publication.copyShort && (
                      <Card className="bg-card/50 border-border/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Copy Corto</CardTitle>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(publication.copyShort, "Copy corto")}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <CardDescription>Para stories o tweets</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground">{publication.copyShort}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Copy Long */}
                    {publication.copyLong && (
                      <Card className="bg-card/50 border-border/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Copy Largo</CardTitle>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(publication.copyLong, "Copy largo")}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <CardDescription>Para posts de feed</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground whitespace-pre-line">{publication.copyLong}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Hashtags */}
                  {publication.hashtags && publication.hashtags.length > 0 && (
                    <Card className="bg-card/50 border-border/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Hashtags</CardTitle>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="gap-2"
                            onClick={() => copyToClipboard(publication.hashtags.join(' '), "Hashtags")}
                          >
                            <Copy className="w-4 h-4" />
                            Copiar todos
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {publication.hashtags.map((tag, idx) => (
                            <Badge 
                              key={idx}
                              variant="secondary"
                              className="cursor-pointer hover:bg-primary/20"
                              onClick={() => copyToClipboard(tag.startsWith('#') ? tag : `#${tag}`, "Hashtag")}
                            >
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tip of the Day */}
                  {publication.tipOfTheDay && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">Consejo del día</p>
                            <p className="text-sm text-muted-foreground">{publication.tipOfTheDay}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleSave} variant="outline" className="gap-2">
                      <Save className="w-4 h-4" />
                      Guardar
                    </Button>
                    
                    {!publication.published && (
                      <>
                        <Button 
                          onClick={() => handleMarkPublished('instagram')} 
                          variant="outline" 
                          className="gap-2"
                        >
                          <Instagram className="w-4 h-4" />
                          Publicado en Instagram
                        </Button>
                        <Button 
                          onClick={() => handleMarkPublished('linkedin')} 
                          variant="outline" 
                          className="gap-2"
                        >
                          <Linkedin className="w-4 h-4" />
                          Publicado en LinkedIn
                        </Button>
                        <Button 
                          onClick={() => handleMarkPublished('twitter')} 
                          variant="outline" 
                          className="gap-2"
                        >
                          <Twitter className="w-4 h-4" />
                          Publicado en X
                        </Button>
                      </>
                    )}
                    
                    {publication.published && (
                      <Badge variant="secondary" className="bg-success/20 text-success border-success/30 h-10 px-4">
                        <Check className="w-4 h-4 mr-2" />
                        Publicado
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Content Bank */}
            <TabsContent value="bank" className="space-y-4">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookMarked className="w-5 h-5" />
                        Banco de Contenido
                      </CardTitle>
                      <CardDescription>
                        Reflexiones y frases guardadas para reutilizar ({filteredContentBank.length} de {contentBank.length})
                      </CardDescription>
                    </div>
                    {contentBank.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={exportToJSON}
                        >
                          <FileJson className="w-4 h-4" />
                          JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={exportToCSV}
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          CSV
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Filters */}
                  {contentBank.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Buscar en frases y reflexiones..."
                          value={bankSearchQuery}
                          onChange={(e) => setBankSearchQuery(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <Select value={bankCategoryFilter} onValueChange={setBankCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {bankCategories.map((cat) => (
                            <SelectItem key={cat} value={cat.toLowerCase()}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {contentBank.length === 0 ? (
                    <div className="py-8 text-center">
                      <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No hay contenido guardado aún</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Guarda reflexiones con el botón ♡ en las frases
                      </p>
                    </div>
                  ) : filteredContentBank.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">No se encontraron resultados</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setBankSearchQuery("");
                          setBankCategoryFilter("all");
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredContentBank.map((item) => (
                        <Card key={item.id} className="bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={cn("capitalize text-xs", getCategoryStyle(item.category || ""))}>
                                    {item.category || "Sin categoría"}
                                  </Badge>
                                  {item.times_used > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      Usado {item.times_used}x
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium text-sm mb-2">"{item.phrase_text}"</p>
                                <p className="text-xs text-muted-foreground line-clamp-3">
                                  {item.reflection}
                                </p>
                                {/* Tags */}
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.tags.map((tag: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-[10px] h-5 gap-1">
                                        <Tag className="w-2.5 h-2.5" />
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {item.notes && (
                                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                                    Nota: {item.notes}
                                  </p>
                                )}
                                {item.image_url && (
                                  <img 
                                    src={item.image_url} 
                                    alt="Saved" 
                                    className="w-20 h-20 object-cover rounded mt-2 cursor-pointer"
                                    onClick={() => {
                                      setSelectedImage({ url: item.image_url, category: item.category || "Guardado" });
                                      setImageDialogOpen(true);
                                    }}
                                  />
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => copyToClipboard(item.phrase_text, "Frase")}
                                  title="Copiar frase"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => generateStoryFromBank(item)}
                                  title="Generar Story"
                                >
                                  <Smartphone className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteFromContentBank(item.id)}
                                  title="Eliminar"
                                >
                                  <span className="text-xs">✕</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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
                  <CardDescription>
                    Total: {publications.length} · Publicadas: {publishedCount} · Pendientes: {pendingCount}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {publications.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay publicaciones aún</p>
                        <p className="text-sm">Genera contenido desde la pestaña "Hoy"</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {publications.map(pub => (
                          <div
                            key={pub.id}
                            className="p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedPublication(pub);
                              setViewDialogOpen(true);
                            }}
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
                                    <Badge key={idx} variant="outline" className="text-xs capitalize">
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
                              
                              <Eye className="w-4 h-4 text-muted-foreground" />
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
                        <Badge variant="outline" className={cn("text-xs capitalize", getCategoryStyle(phrase.category))}>
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

      {/* Image Preview Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista previa de imagen - {selectedImage?.category}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.category}
                className="w-full h-auto rounded-lg"
              />
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                <Badge className="bg-background/80 backdrop-blur-sm capitalize">
                  {selectedImage.category}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 bg-background/80 backdrop-blur-sm"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedImage.url;
                    link.download = `${selectedImage.category}-${new Date().toISOString().split('T')[0]}.png`;
                    link.click();
                  }}
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save with Tags Dialog */}
      <Dialog open={saveTagsDialogOpen} onOpenChange={setSaveTagsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Guardar en Banco de Contenido
            </DialogTitle>
          </DialogHeader>
          {phraseToSave && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">"{phraseToSave.text}"</p>
                <Badge className={cn("mt-2 text-xs", getCategoryStyle(phraseToSave.category))}>
                  {phraseToSave.category}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags (separados por coma)
                </Label>
                <Input
                  placeholder="ej: favorita, lunes, energía..."
                  value={saveTags}
                  onChange={(e) => setSaveTags(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notas personales (opcional)</Label>
                <Textarea
                  placeholder="Por qué te gusta esta frase, cuándo usarla..."
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  className="h-20"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSaveTagsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveToContentBank} className="gap-2">
                  <Save className="w-4 h-4" />
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Regenerate Dialog */}
      <AlertDialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              ¿Regenerar contenido?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ya tienes {publication?.phrases.length || 0} frases generadas para hoy. 
              Si regeneras, las frases actuales serán reemplazadas por nuevas.
              Las imágenes de Story generadas también se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doGenerate} className="bg-amber-600 hover:bg-amber-700">
              Sí, regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Phrase Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Reflexión
            </DialogTitle>
            <DialogDescription>
              Modifica el contenido antes de guardarlo o publicarlo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Frase corta (para título)</Label>
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="h-20"
                placeholder="La frase principal..."
              />
              <p className="text-xs text-muted-foreground">
                {editedText.length}/200 caracteres
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Reflexión larga (para Story y posts)</Label>
              <Textarea
                value={editedTextLong}
                onChange={(e) => setEditedTextLong(e.target.value)}
                className="h-48"
                placeholder="La reflexión completa..."
              />
              <p className="text-xs text-muted-foreground">
                Esta es la reflexión que aparecerá en las Stories y posts largos.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>CTA / Llamada a la acción (opcional)</Label>
              <Input
                value={editedCta}
                onChange={(e) => setEditedCta(e.target.value)}
                placeholder="Ej: ¿Te ha pasado algo parecido?"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEditedPhrase} className="gap-2">
              <Save className="w-4 h-4" />
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Publications;
