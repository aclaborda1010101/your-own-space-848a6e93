import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  User, 
  Target, 
  Brain, 
  Heart, 
  Clock,
  Shield,
  AlertTriangle,
  Save,
  Loader2,
  Plus,
  X,
  Briefcase,
  Home,
  Apple,
  MessageSquare
} from "lucide-react";
import { useUserProfile, UserProfile } from "@/hooks/useUserProfile";
import { Json } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper to safely get array from Json
const getArrayFromJson = (value: Json | null | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
};

// Helper to safely get object from Json
const getObjectFromJson = (value: Json | null | undefined): Record<string, string> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'string') {
        result[key] = val;
      }
    }
    return result;
  }
  return {};
};

export const ProfileSettingsCard = () => {
  const { profile, loading, saving, updateProfile } = useUserProfile();
  
  // Identity
  const [name, setName] = useState("");
  const [vitalRole, setVitalRole] = useState("");
  const [currentContext, setCurrentContext] = useState("");
  const [cognitiveStyle, setCognitiveStyle] = useState("");
  
  // Languages
  const [primaryLanguage, setPrimaryLanguage] = useState("es");
  const [secondaryLanguage, setSecondaryLanguage] = useState("en");
  
  // Arrays as strings for editing
  const [principles, setPrinciples] = useState<string[]>([]);
  const [lifeGoals, setLifeGoals] = useState<string[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<string[]>([]);
  const [personalRules, setPersonalRules] = useState<string[]>([]);
  const [autoDecisions, setAutoDecisions] = useState<string[]>([]);
  const [requireConfirmation, setRequireConfirmation] = useState<string[]>([]);
  const [foodDislikes, setFoodDislikes] = useState<string[]>([]);
  
  // Objects
  const [familyContext, setFamilyContext] = useState<Record<string, string>>({});
  const [healthProfile, setHealthProfile] = useState<Record<string, string>>({});
  const [foodPreferences, setFoodPreferences] = useState<Record<string, string>>({});
  const [communicationStyle, setCommunicationStyle] = useState<Record<string, string>>({});
  
  // Schedule
  const [bestFocusTime, setBestFocusTime] = useState("morning");
  const [fatigueTime, setFatigueTime] = useState("afternoon");
  const [needsBuffers, setNeedsBuffers] = useState(true);

  // My identifiers
  const [waNames, setWaNames] = useState<string[]>([]);
  const [waNumbers, setWaNumbers] = useState<string[]>([]);
  const [plaudLabels, setPlaudLabels] = useState<string[]>([]);
  const [newWaName, setNewWaName] = useState("");
  const [newWaNumber, setNewWaNumber] = useState("");
  const [newPlaudLabel, setNewPlaudLabel] = useState("");
  
  // New item inputs
  const [newPrinciple, setNewPrinciple] = useState("");
  const [newLifeGoal, setNewLifeGoal] = useState("");
  const [newProfGoal, setNewProfGoal] = useState("");
  const [newRule, setNewRule] = useState("");
  const [newAutoDecision, setNewAutoDecision] = useState("");
  const [newConfirmation, setNewConfirmation] = useState("");
  const [newFoodDislike, setNewFoodDislike] = useState("");

  // Sync with profile
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setVitalRole(profile.vital_role || "");
      setCurrentContext(profile.current_context || "");
      setCognitiveStyle(profile.cognitive_style || "");
      setPrimaryLanguage(profile.primary_language || "es");
      setSecondaryLanguage(profile.secondary_language || "en");
      setPrinciples(getArrayFromJson(profile.personal_principles));
      setLifeGoals(getArrayFromJson(profile.life_goals));
      setProfessionalGoals(getArrayFromJson(profile.professional_goals));
      setPersonalRules(getArrayFromJson(profile.personal_rules));
      setAutoDecisions(getArrayFromJson(profile.auto_decisions));
      setRequireConfirmation(getArrayFromJson(profile.require_confirmation));
      setFoodDislikes(getArrayFromJson(profile.food_dislikes));
      setFamilyContext(getObjectFromJson(profile.family_context));
      setHealthProfile(getObjectFromJson(profile.health_profile));
      setFoodPreferences(getObjectFromJson(profile.food_preferences));
      setCommunicationStyle(getObjectFromJson(profile.communication_style));
      setBestFocusTime(profile.best_focus_time || "morning");
      setFatigueTime(profile.fatigue_time || "afternoon");
      setNeedsBuffers(profile.needs_buffers ?? true);
      // My identifiers
      const ids = profile.my_identifiers && typeof profile.my_identifiers === 'object' && !Array.isArray(profile.my_identifiers)
        ? profile.my_identifiers as Record<string, unknown>
        : {};
      setWaNames(Array.isArray(ids.whatsapp_names) ? (ids.whatsapp_names as string[]) : []);
      setWaNumbers(Array.isArray(ids.whatsapp_numbers) ? (ids.whatsapp_numbers as string[]) : []);
      setPlaudLabels(Array.isArray(ids.plaud_speaker_labels) ? (ids.plaud_speaker_labels as string[]) : []);
    }
  }, [profile]);

  const handleSave = async () => {
    const updates: Partial<UserProfile> = {
      name: name || null,
      vital_role: vitalRole || null,
      current_context: currentContext || null,
      cognitive_style: cognitiveStyle || null,
      primary_language: primaryLanguage,
      secondary_language: secondaryLanguage,
      personal_principles: principles,
      life_goals: lifeGoals,
      professional_goals: professionalGoals,
      personal_rules: personalRules,
      auto_decisions: autoDecisions,
      require_confirmation: requireConfirmation,
      food_dislikes: foodDislikes,
      family_context: familyContext,
      health_profile: healthProfile,
      food_preferences: foodPreferences,
      communication_style: communicationStyle,
      best_focus_time: bestFocusTime,
      fatigue_time: fatigueTime,
      needs_buffers: needsBuffers,
      my_identifiers: {
        whatsapp_names: waNames,
        whatsapp_numbers: waNumbers,
        plaud_speaker_labels: plaudLabels,
      },
    };
    await updateProfile(updates);
  };

  const addToArray = (arr: string[], setArr: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    if (value.trim()) {
      setArr([...arr, value.trim()]);
      setValue("");
    }
  };

  const removeFromArray = (arr: string[], setArr: (v: string[]) => void, index: number) => {
    setArr(arr.filter((_, i) => i !== index));
  };

  const updateObjectField = (
    obj: Record<string, string>, 
    setObj: (v: Record<string, string>) => void, 
    key: string, 
    value: string
  ) => {
    setObj({ ...obj, [key]: value });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Perfil JARVIS
        </CardTitle>
        <CardDescription>
          Configura tu perfil para que JARVIS te conozca mejor y personalice sus recomendaciones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 mb-6">
            <TabsTrigger value="identity" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              Identidad
            </TabsTrigger>
            <TabsTrigger value="goals" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              Objetivos
            </TabsTrigger>
            <TabsTrigger value="lifestyle" className="text-xs">
              <Heart className="h-3 w-3 mr-1" />
              Vida
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Horarios
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Reglas
            </TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitalRole">Rol vital</Label>
                <Input
                  id="vitalRole"
                  value={vitalRole}
                  onChange={(e) => setVitalRole(e.target.value)}
                  placeholder="Ej: Emprendedor, padre, estudiante"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currentContext">Contexto actual</Label>
              <Textarea
                id="currentContext"
                value={currentContext}
                onChange={(e) => setCurrentContext(e.target.value)}
                placeholder="Describe tu situación actual..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cognitiveStyle">Estilo cognitivo</Label>
              <Input
                id="cognitiveStyle"
                value={cognitiveStyle}
                onChange={(e) => setCognitiveStyle(e.target.value)}
                placeholder="Ej: Analítico-creativo, alta autoexigencia"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Idioma principal</Label>
                <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Idioma secundario</Label>
                <Select value={secondaryLanguage} onValueChange={setSecondaryLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Principles */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                Principios personales
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newPrinciple}
                  onChange={(e) => setNewPrinciple(e.target.value)}
                  placeholder="Añadir principio..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(principles, setPrinciples, newPrinciple, setNewPrinciple))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(principles, setPrinciples, newPrinciple, setNewPrinciple)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {principles.map((p, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {p}
                    <button onClick={() => removeFromArray(principles, setPrinciples, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* My Identifiers */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Mis identidades (para importaciones)
              </Label>
              <p className="text-xs text-muted-foreground">
                Nombres y números con los que apareces en chats de WhatsApp y grabaciones Plaud
              </p>

              {/* WhatsApp Names */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nombres en WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    value={newWaName}
                    onChange={(e) => setNewWaName(e.target.value)}
                    placeholder="Ej: Agustin"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(waNames, setWaNames, newWaName, setNewWaName))}
                  />
                  <Button type="button" size="icon" variant="outline" onClick={() => addToArray(waNames, setWaNames, newWaName, setNewWaName)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {waNames.map((n, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {n}
                      <button onClick={() => removeFromArray(waNames, setWaNames, i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* WhatsApp Numbers */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Números de WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    value={newWaNumber}
                    onChange={(e) => setNewWaNumber(e.target.value)}
                    placeholder="Ej: 635871339"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(waNumbers, setWaNumbers, newWaNumber, setNewWaNumber))}
                  />
                  <Button type="button" size="icon" variant="outline" onClick={() => addToArray(waNumbers, setWaNumbers, newWaNumber, setNewWaNumber)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {waNumbers.map((n, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {n}
                      <button onClick={() => removeFromArray(waNumbers, setWaNumbers, i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Plaud Labels */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Etiquetas de Plaud</Label>
                <div className="flex gap-2">
                  <Input
                    value={newPlaudLabel}
                    onChange={(e) => setNewPlaudLabel(e.target.value)}
                    placeholder="Ej: Speaker 1"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(plaudLabels, setPlaudLabels, newPlaudLabel, setNewPlaudLabel))}
                  />
                  <Button type="button" size="icon" variant="outline" onClick={() => addToArray(plaudLabels, setPlaudLabels, newPlaudLabel, setNewPlaudLabel)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {plaudLabels.map((n, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {n}
                      <button onClick={() => removeFromArray(plaudLabels, setPlaudLabels, i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Communication Style */}
            <div className="space-y-3">
              <Label>Estilo de comunicación preferido</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tono</Label>
                  <Input
                    value={communicationStyle.tone || ""}
                    onChange={(e) => updateObjectField(communicationStyle, setCommunicationStyle, 'tone', e.target.value)}
                    placeholder="Ej: Directo, humano, sin tecnicismos"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Formato</Label>
                  <Input
                    value={communicationStyle.format || ""}
                    onChange={(e) => updateObjectField(communicationStyle, setCommunicationStyle, 'format', e.target.value)}
                    placeholder="Ej: Listas, resúmenes concisos"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-6">
            {/* Life Goals */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4 text-success" />
                Objetivos vitales
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newLifeGoal}
                  onChange={(e) => setNewLifeGoal(e.target.value)}
                  placeholder="Añadir objetivo vital..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(lifeGoals, setLifeGoals, newLifeGoal, setNewLifeGoal))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(lifeGoals, setLifeGoals, newLifeGoal, setNewLifeGoal)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {lifeGoals.map((g, i) => (
                  <Badge key={i} variant="outline" className="gap-1 border-success/50 text-success">
                    {g}
                    <button onClick={() => removeFromArray(lifeGoals, setLifeGoals, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Professional Goals */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Objetivos profesionales
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newProfGoal}
                  onChange={(e) => setNewProfGoal(e.target.value)}
                  placeholder="Añadir objetivo profesional..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(professionalGoals, setProfessionalGoals, newProfGoal, setNewProfGoal))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(professionalGoals, setProfessionalGoals, newProfGoal, setNewProfGoal)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {professionalGoals.map((g, i) => (
                  <Badge key={i} variant="outline" className="gap-1 border-primary/50 text-primary">
                    {g}
                    <button onClick={() => removeFromArray(professionalGoals, setProfessionalGoals, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Lifestyle Tab */}
          <TabsContent value="lifestyle" className="space-y-6">
            {/* Family Context */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Home className="h-4 w-4 text-warning" />
                Contexto familiar
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Situación familiar</Label>
                  <Input
                    value={familyContext.situation || ""}
                    onChange={(e) => updateObjectField(familyContext, setFamilyContext, 'situation', e.target.value)}
                    placeholder="Ej: Casado, hijo pequeño"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Prioridades familiares</Label>
                  <Input
                    value={familyContext.priorities || ""}
                    onChange={(e) => updateObjectField(familyContext, setFamilyContext, 'priorities', e.target.value)}
                    placeholder="Ej: Tiempo de calidad, presencia"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Health Profile */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-destructive" />
                Perfil de salud
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Actividad física</Label>
                  <Input
                    value={healthProfile.activity || ""}
                    onChange={(e) => updateObjectField(healthProfile, setHealthProfile, 'activity', e.target.value)}
                    placeholder="Ej: Entrenamiento regular, 4x semana"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Condiciones relevantes</Label>
                  <Input
                    value={healthProfile.conditions || ""}
                    onChange={(e) => updateObjectField(healthProfile, setHealthProfile, 'conditions', e.target.value)}
                    placeholder="Ej: Ninguna / Estrés"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Food Preferences */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Apple className="h-4 w-4 text-success" />
                Preferencias alimentarias
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Dieta preferida</Label>
                  <Input
                    value={foodPreferences.diet || ""}
                    onChange={(e) => updateObjectField(foodPreferences, setFoodPreferences, 'diet', e.target.value)}
                    placeholder="Ej: Keto, mediterránea, equilibrada"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Estilo de cocina</Label>
                  <Input
                    value={foodPreferences.style || ""}
                    onChange={(e) => updateObjectField(foodPreferences, setFoodPreferences, 'style', e.target.value)}
                    placeholder="Ej: Simple, rápida, batch cooking"
                  />
                </div>
              </div>
            </div>

            {/* Food Dislikes */}
            <div className="space-y-3">
              <Label className="text-muted-foreground">Alimentos que NO te gustan</Label>
              <div className="flex gap-2">
                <Input
                  value={newFoodDislike}
                  onChange={(e) => setNewFoodDislike(e.target.value)}
                  placeholder="Añadir alimento..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(foodDislikes, setFoodDislikes, newFoodDislike, setNewFoodDislike))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(foodDislikes, setFoodDislikes, newFoodDislike, setNewFoodDislike)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {foodDislikes.map((f, i) => (
                  <Badge key={i} variant="destructive" className="gap-1">
                    {f}
                    <button onClick={() => removeFromArray(foodDislikes, setFoodDislikes, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Mejor momento para concentración</Label>
                <Select value={bestFocusTime} onValueChange={setBestFocusTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early_morning">Muy temprano (5-7h)</SelectItem>
                    <SelectItem value="morning">Mañana (8-12h)</SelectItem>
                    <SelectItem value="midday">Mediodía (12-14h)</SelectItem>
                    <SelectItem value="afternoon">Tarde (15-18h)</SelectItem>
                    <SelectItem value="evening">Noche (19-22h)</SelectItem>
                    <SelectItem value="night">Noche tardía (22h+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Momento de mayor fatiga</Label>
                <Select value={fatigueTime} onValueChange={setFatigueTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early_morning">Muy temprano (5-7h)</SelectItem>
                    <SelectItem value="morning">Mañana (8-12h)</SelectItem>
                    <SelectItem value="midday">Mediodía (12-14h)</SelectItem>
                    <SelectItem value="afternoon">Tarde (15-18h)</SelectItem>
                    <SelectItem value="evening">Noche (19-22h)</SelectItem>
                    <SelectItem value="night">Noche tardía (22h+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label>Necesito buffers entre tareas</Label>
                <p className="text-xs text-muted-foreground">
                  JARVIS añadirá tiempo de margen entre bloques de trabajo
                </p>
              </div>
              <Switch checked={needsBuffers} onCheckedChange={setNeedsBuffers} />
            </div>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-6">
            {/* Personal Rules */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Reglas personales
              </Label>
              <p className="text-xs text-muted-foreground">
                Límites que JARVIS debe respetar siempre
              </p>
              <div className="flex gap-2">
                <Input
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  placeholder="Ej: No más de 3 prioridades al día"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(personalRules, setPersonalRules, newRule, setNewRule))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(personalRules, setPersonalRules, newRule, setNewRule)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {personalRules.map((r, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    {r}
                    <button onClick={() => removeFromArray(personalRules, setPersonalRules, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Auto Decisions */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-success">
                <Shield className="h-4 w-4" />
                JARVIS puede decidir automáticamente
              </Label>
              <p className="text-xs text-muted-foreground">
                Acciones que JARVIS puede tomar sin preguntarte
              </p>
              <div className="flex gap-2">
                <Input
                  value={newAutoDecision}
                  onChange={(e) => setNewAutoDecision(e.target.value)}
                  placeholder="Ej: Reordenar tareas, ajustar bloques"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(autoDecisions, setAutoDecisions, newAutoDecision, setNewAutoDecision))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(autoDecisions, setAutoDecisions, newAutoDecision, setNewAutoDecision)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {autoDecisions.map((d, i) => (
                  <Badge key={i} className="gap-1 bg-success/20 text-success border-success/30">
                    {d}
                    <button onClick={() => removeFromArray(autoDecisions, setAutoDecisions, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Require Confirmation */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Requiere confirmación obligatoria
              </Label>
              <p className="text-xs text-muted-foreground">
                Decisiones que JARVIS NUNCA debe tomar sin preguntarte
              </p>
              <div className="flex gap-2">
                <Input
                  value={newConfirmation}
                  onChange={(e) => setNewConfirmation(e.target.value)}
                  placeholder="Ej: Quitar tiempo familiar, decisiones financieras"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray(requireConfirmation, setRequireConfirmation, newConfirmation, setNewConfirmation))}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray(requireConfirmation, setRequireConfirmation, newConfirmation, setNewConfirmation)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {requireConfirmation.map((c, i) => (
                  <Badge key={i} variant="destructive" className="gap-1">
                    {c}
                    <button onClick={() => removeFromArray(requireConfirmation, setRequireConfirmation, i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="mt-6 pt-6 border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar perfil
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
