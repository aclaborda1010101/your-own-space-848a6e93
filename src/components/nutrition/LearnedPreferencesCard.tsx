import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ThumbsUp, ThumbsDown, ChefHat, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface LearnedPreferences {
  likes: string[];
  dislikes: string[];
  favorite_cuisines?: string[];
  cooking_preferences?: string[];
  other_notes?: string[];
  summary?: string;
}

interface LearnedPreferencesCardProps {
  chatMessages: ChatMessage[];
}

export function LearnedPreferencesCard({ chatMessages }: LearnedPreferencesCardProps) {
  const [preferences, setPreferences] = useState<LearnedPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzePreferences = async () => {
    if (chatMessages.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('nutrition-preferences-summary', {
        body: { chatHistory: chatMessages }
      });

      if (error) throw error;
      setPreferences(data);
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Error analyzing preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-analyze when chat has enough messages
    if (chatMessages.length >= 4 && !hasAnalyzed) {
      analyzePreferences();
    }
  }, [chatMessages.length]);

  const hasContent = preferences && (
    preferences.likes?.length > 0 || 
    preferences.dislikes?.length > 0 ||
    preferences.favorite_cuisines?.length > 0 ||
    preferences.cooking_preferences?.length > 0
  );

  if (chatMessages.length < 2) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Preferencias Aprendidas
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={analyzePreferences}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasContent ? (
          <div className="space-y-4">
            {preferences.summary && (
              <p className="text-sm text-muted-foreground italic">
                "{preferences.summary}"
              </p>
            )}

            {preferences.likes && preferences.likes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3 text-green-500" />
                  Le gusta
                </p>
                <div className="flex flex-wrap gap-1">
                  {preferences.likes.map((item, i) => (
                    <Badge key={i} variant="default" className="text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {preferences.dislikes && preferences.dislikes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <ThumbsDown className="w-3 h-3 text-red-500" />
                  No le gusta
                </p>
                <div className="flex flex-wrap gap-1">
                  {preferences.dislikes.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs border-red-300 text-red-600">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {preferences.favorite_cuisines && preferences.favorite_cuisines.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <ChefHat className="w-3 h-3" />
                  Cocinas favoritas
                </p>
                <div className="flex flex-wrap gap-1">
                  {preferences.favorite_cuisines.map((item, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {preferences.cooking_preferences && preferences.cooking_preferences.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Preferencias de cocina</p>
                <div className="flex flex-wrap gap-1">
                  {preferences.cooking_preferences.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Chatea con Jarvis para que aprenda tus gustos y preferencias alimentarias.
            </p>
            {chatMessages.length >= 2 && !hasAnalyzed && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={analyzePreferences}
              >
                <Brain className="w-4 h-4 mr-2" />
                Analizar conversación
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
