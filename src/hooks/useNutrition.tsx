import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NutritionPreferences {
  id?: string;
  diet_type: string;
  restrictions: string[];
  allergies: string[];
  goals: string;
  calories_target: number;
  proteins_target: number;
  carbs_target: number;
  fats_target: number;
  meal_count: number;
  preferences_notes: string | null;
}

interface MealOption {
  name: string;
  description: string;
  calories: number;
  prep_time: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const useNutrition = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NutritionPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Fetch preferences
  useEffect(() => {
    if (!user) return;
    
    const fetchPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('nutrition_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setPreferences(data as NutritionPreferences);
        } else {
          // Default preferences
          setPreferences({
            diet_type: 'balanced',
            restrictions: [],
            allergies: [],
            goals: 'maintain',
            calories_target: 2000,
            proteins_target: 100,
            carbs_target: 250,
            fats_target: 70,
            meal_count: 3,
            preferences_notes: null,
          });
        }
      } catch (error) {
        console.error('Error fetching nutrition preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  // Save preferences
  const savePreferences = async (newPreferences: Partial<NutritionPreferences>) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const dataToSave = {
        ...preferences,
        ...newPreferences,
        user_id: user.id,
      };

      const { error } = await supabase
        .from('nutrition_preferences')
        .upsert(dataToSave, { onConflict: 'user_id' });

      if (error) throw error;
      
      setPreferences(dataToSave as NutritionPreferences);
      toast.success('Preferencias guardadas');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Error al guardar preferencias');
    } finally {
      setSaving(false);
    }
  };

  // Generate dynamic meals
  const generateMeals = async (checkIn: { energy: number; mood: number }, whoopsSummary?: string): Promise<{ lunch_options: MealOption[]; dinner_options: MealOption[] } | null> => {
    if (!user) return null;

    try {
      const response = await supabase.functions.invoke('jarvis-nutrition', {
        body: {
          action: 'generate-meals',
          preferences,
          checkIn,
          whoopsSummary,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    } catch (error) {
      console.error('Error generating meals:', error);
      toast.error('Error al generar opciones de comida');
      return null;
    }
  };

  // Chat with Jarvis Nutrition
  const sendChatMessage = useCallback(async (message: string) => {
    if (!user) return;
    
    const userMessage: ChatMessage = { role: 'user', content: message };
    setChatMessages(prev => [...prev, userMessage]);
    setChatLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-nutrition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'chat',
          messages: [...chatMessages, userMessage],
          preferences,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Límite de peticiones excedido, intenta más tarde');
          return;
        }
        if (response.status === 402) {
          toast.error('Créditos agotados');
          return;
        }
        throw new Error('Error en la respuesta');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let assistantContent = '';

      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setChatMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantContent };
                return newMessages;
              });
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      toast.error('Error al enviar mensaje');
    } finally {
      setChatLoading(false);
    }
  }, [user, chatMessages, preferences]);

  const clearChat = () => {
    setChatMessages([]);
  };

  return {
    preferences,
    loading,
    saving,
    savePreferences,
    generateMeals,
    chatMessages,
    chatLoading,
    sendChatMessage,
    clearChat,
  };
};
