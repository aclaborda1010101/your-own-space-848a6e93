import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useBosco } from "@/hooks/useBosco";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Check, 
  Trash2, 
  Plus, 
  Play, 
  BookOpen,
  Gamepad2,
  Sparkles,
  Move,
  Moon,
  Globe,
  Star,
  Clock,
  Zap,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  juego_vinculo: { label: "Juego & Vínculo", icon: Gamepad2, color: "text-pink-500" },
  lectura: { label: "Lectura", icon: BookOpen, color: "text-blue-500" },
  ingles_ludico: { label: "Inglés Lúdico", icon: Globe, color: "text-green-500" },
  ia_ninos: { label: "IA para Niños", icon: Sparkles, color: "text-purple-500" },
  movimiento: { label: "Movimiento", icon: Move, color: "text-orange-500" },
  cierre_dia: { label: "Cierre del Día", icon: Moon, color: "text-indigo-500" },
};

const WORD_CATEGORIES = [
  "animales", "colores", "números", "objetos", "acciones", "comida", "familia", "ropa", "cuerpo", "casa"
];

export default function Bosco() {
  const { isOpen: sidebarOpen, open: openSidebar, close: closeSidebar, isCollapsed, toggleCollapse } = useSidebarState();
  const {
    activities,
    vocabulary,
    loading,
    generatingActivities,
    generateActivities,
    completeActivity,
    deleteActivity,
    addWord,
    practiceWord,
    deleteWord,
    getRandomWords,
    saveSession,
    generateVocabularySuggestions
  } = useBosco();

  const [newWordEn, setNewWordEn] = useState("");
  const [newWordEs, setNewWordEs] = useState("");
  const [newWordCategory, setNewWordCategory] = useState("");
  const [gameMode, setGameMode] = useState(false);
  const [gameWords, setGameWords] = useState<any[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gameStats, setGameStats] = useState({ correct: 0, total: 0 });
  const [isEnToEs, setIsEnToEs] = useState(true);
  const [vocabSuggestions, setVocabSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleAddWord = async () => {
    if (newWordEn && newWordEs) {
      await addWord(newWordEn, newWordEs, newWordCategory || undefined);
      setNewWordEn("");
      setNewWordEs("");
      setNewWordCategory("");
    }
  };

  const startGame = () => {
    const words = getRandomWords(5);
    if (words.length === 0) return;
    setGameWords(words);
    setCurrentWordIndex(0);
    setShowAnswer(false);
    setGameStats({ correct: 0, total: 0 });
    setIsEnToEs(Math.random() > 0.5);
    setGameMode(true);
  };

  const handleGameAnswer = async (correct: boolean) => {
    const word = gameWords[currentWordIndex];
    await practiceWord(word.id, correct);
    
    setGameStats(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1
    }));

    if (currentWordIndex < gameWords.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
      setShowAnswer(false);
      setIsEnToEs(Math.random() > 0.5);
    } else {
      // Game finished
      await saveSession(
        gameWords.map(w => w.id),
        gameStats.correct + (correct ? 1 : 0),
        gameStats.total + 1
      );
      setGameMode(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    const suggestions = await generateVocabularySuggestions();
    setVocabSuggestions(suggestions);
    setLoadingSuggestions(false);
  };

  const handleAddSuggestion = async (word: any) => {
    await addWord(word.en, word.es, word.category);
    setVocabSuggestions(prev => prev.filter(w => w.en !== word.en));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <div className={cn("transition-all duration-300", isCollapsed ? "lg:ml-16" : "lg:ml-64")}>
        <TopBar onMenuClick={openSidebar} />
          <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <div className={cn("transition-all duration-300", isCollapsed ? "lg:ml-16" : "lg:ml-64")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="p-4 md:p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Bosco</h1>
              <p className="text-muted-foreground text-sm">Actividades y vocabulario</p>
            </div>
          </div>

          <Tabs defaultValue="activities" className="space-y-4">
            <TabsList>
              <TabsTrigger value="activities">Actividades</TabsTrigger>
              <TabsTrigger value="vocabulary">Vocabulario Inglés</TabsTrigger>
            </TabsList>

            <TabsContent value="activities" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={() => generateActivities('all')}
                  disabled={generatingActivities}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", generatingActivities && "animate-spin")} />
                  Generar actividades
                </Button>
                {Object.entries(ACTIVITY_TYPE_CONFIG).map(([type, config]) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => generateActivities(type)}
                    disabled={generatingActivities}
                  >
                    <config.icon className={cn("w-4 h-4 mr-1", config.color)} />
                    {config.label}
                  </Button>
                ))}
              </div>

              {activities.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay actividades para hoy</p>
                    <Button className="mt-4" onClick={() => generateActivities('all')}>
                      Generar actividades
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {activities.map((activity) => {
                    const config = ACTIVITY_TYPE_CONFIG[activity.activity_type] || ACTIVITY_TYPE_CONFIG.juego_vinculo;
                    const Icon = config.icon;
                    
                    return (
                      <Card key={activity.id} className={cn(activity.completed && "opacity-60")}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("w-5 h-5", config.color)} />
                              <CardTitle className="text-base">{activity.title}</CardTitle>
                            </div>
                            <div className="flex gap-1">
                              {!activity.completed && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-success hover:text-success"
                                  onClick={() => completeActivity(activity.id)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteActivity(activity.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          
                          {/* Detailed instructions */}
                          {activity.notes && (
                            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                              <p className="text-xs font-medium text-foreground mb-2">Cómo hacerlo:</p>
                              <p className="text-xs text-muted-foreground whitespace-pre-line">{activity.notes}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {activity.duration_minutes} min
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Globe className="w-3 h-3 mr-1" />
                              {activity.language === 'es' ? 'Español' : activity.language === 'en' ? 'English' : 'Mixto'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Zap className="w-3 h-3 mr-1" />
                              {activity.energy_level === 'high' ? 'Alta energía' : activity.energy_level === 'low' ? 'Baja energía' : 'Media'}
                            </Badge>
                            {activity.completed && (
                              <Badge variant="default" className="text-xs bg-success">
                                <Check className="w-3 h-3 mr-1" />
                                Completada
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="vocabulary" className="space-y-4">
              {gameMode ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Juego de vocabulario</span>
                      <Badge>{currentWordIndex + 1} / {gameWords.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-2">
                        {isEnToEs ? "¿Qué significa en español?" : "¿Cómo se dice en inglés?"}
                      </p>
                      <p className="text-4xl font-bold mb-6">
                        {isEnToEs ? gameWords[currentWordIndex]?.word_en : gameWords[currentWordIndex]?.word_es}
                      </p>
                      
                      {showAnswer ? (
                        <>
                          <p className="text-2xl text-primary mb-6">
                            {isEnToEs ? gameWords[currentWordIndex]?.word_es : gameWords[currentWordIndex]?.word_en}
                          </p>
                          <div className="flex gap-4 justify-center">
                            <Button variant="outline" onClick={() => handleGameAnswer(false)}>
                              No lo sabía
                            </Button>
                            <Button onClick={() => handleGameAnswer(true)}>
                              <Check className="w-4 h-4 mr-2" />
                              ¡Lo sabía!
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button size="lg" onClick={() => setShowAnswer(true)}>
                          Ver respuesta
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Aciertos: {gameStats.correct} / {gameStats.total}
                      </p>
                      <Button variant="ghost" onClick={() => setGameMode(false)}>
                        Cancelar juego
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Inglés</label>
                      <Input
                        placeholder="cat"
                        value={newWordEn}
                        onChange={(e) => setNewWordEn(e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Español</label>
                      <Input
                        placeholder="gato"
                        value={newWordEs}
                        onChange={(e) => setNewWordEs(e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Categoría</label>
                      <select
                        value={newWordCategory}
                        onChange={(e) => setNewWordCategory(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        <option value="">Sin categoría</option>
                        {WORD_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={handleAddWord} disabled={!newWordEn || !newWordEs}>
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={startGame}
                      disabled={vocabulary.filter(w => !w.is_mastered).length === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Jugar
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleGenerateSuggestions}
                      disabled={loadingSuggestions}
                    >
                      <Wand2 className={cn("w-4 h-4 mr-2", loadingSuggestions && "animate-spin")} />
                      Sugerir 30 palabras
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Palabras por aprender ({vocabulary.filter(w => !w.is_mastered).length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {vocabulary.filter(w => !w.is_mastered).map((word) => (
                              <div 
                                key={word.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                              >
                                <div>
                                  <span className="font-medium">{word.word_en}</span>
                                  <span className="text-muted-foreground mx-2">→</span>
                                  <span>{word.word_es}</span>
                                  {word.category && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {word.category}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {word.times_practiced}x
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => deleteWord(word.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {vocabulary.filter(w => !w.is_mastered).length === 0 && (
                              <p className="text-center text-muted-foreground py-4">
                                No hay palabras pendientes
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          Palabras dominadas ({vocabulary.filter(w => w.is_mastered).length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {vocabulary.filter(w => w.is_mastered).map((word) => (
                              <div 
                                key={word.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-success/10"
                              >
                                <div>
                                  <span className="font-medium">{word.word_en}</span>
                                  <span className="text-muted-foreground mx-2">→</span>
                                  <span>{word.word_es}</span>
                                </div>
                                <Star className="w-4 h-4 text-yellow-500" />
                              </div>
                            ))}
                            {vocabulary.filter(w => w.is_mastered).length === 0 && (
                              <p className="text-center text-muted-foreground py-4">
                                Aún no hay palabras dominadas
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
