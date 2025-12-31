import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface Phrase {
  category: string;
  text: string;
  textLong: string;
  cta?: string;
  imageUrl?: string;
  imageStyle?: string;
}

export interface ImageStyle {
  id: string;
  name: string;
}

export interface DailyPublication {
  id?: string;
  date: string;
  phrases: Phrase[];
  selectedPhrase?: Phrase;
  copyShort: string;
  copyLong: string;
  hashtags: string[];
  tipOfTheDay: string;
  published: boolean;
}

export const IMAGE_STYLES: ImageStyle[] = [
  { id: "minimalist", name: "Minimalista" },
  { id: "dark", name: "Oscuro" },
  { id: "colorful", name: "Colorido" },
  { id: "corporate", name: "Corporate" },
  { id: "neon", name: "Neón" },
  { id: "organic", name: "Orgánico" },
];

export const useJarvisPublications = () => {
  const { user } = useAuth();
  const [publication, setPublication] = useState<DailyPublication | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("dark");
  const [error, setError] = useState<string | null>(null);

  const generateContent = useCallback(async (options?: {
    topic?: string;
    tone?: string;
    audience?: string;
    challengeName?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-publications', {
        body: options || {},
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      const pub: DailyPublication = {
        date: new Date().toISOString().split("T")[0],
        phrases: data.phrases || [],
        copyShort: data.copyShort || "",
        copyLong: data.copyLong || "",
        hashtags: data.hashtags || [],
        tipOfTheDay: data.tipOfTheDay || "",
        published: false,
      };

      setPublication(pub);
      toast.success("Contenido generado", {
        description: "Ahora puedes generar imágenes para cada frase"
      });
      return pub;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al generar contenido";
      console.error("JARVIS Publicaciones error:", err);
      setError(message);
      
      if (message.includes("429") || message.includes("límite")) {
        toast.error("Límite de uso alcanzado", {
          description: "Intenta de nuevo en unos minutos",
        });
      } else if (message.includes("402") || message.includes("créditos")) {
        toast.error("Créditos agotados", {
          description: "Recarga tu cuenta para continuar",
        });
      } else {
        toast.error("Error al generar contenido", {
          description: message,
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateImageForPhrase = useCallback(async (phraseIndex: number, style?: string) => {
    if (!publication || !publication.phrases[phraseIndex]) return null;

    const phrase = publication.phrases[phraseIndex];
    const styleToUse = style || selectedStyle;
    setGeneratingImage(phrase.category);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-publications', {
        body: {
          action: 'generate-image',
          phraseText: phrase.text,
          phraseCategory: phrase.category,
          imageStyle: styleToUse,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.imageUrl) {
        // Update the phrase with the image and style
        setPublication(prev => {
          if (!prev) return null;
          const updatedPhrases = [...prev.phrases];
          updatedPhrases[phraseIndex] = {
            ...updatedPhrases[phraseIndex],
            imageUrl: data.imageUrl,
            imageStyle: styleToUse,
          };
          return { ...prev, phrases: updatedPhrases };
        });
        
        toast.success("Imagen generada", {
          description: `Imagen para ${phrase.category} lista`
        });
        
        return data.imageUrl;
      }
      
      throw new Error("No se pudo generar la imagen");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al generar imagen";
      console.error("Image generation error:", err);
      toast.error("Error al generar imagen", { description: message });
      return null;
    } finally {
      setGeneratingImage(null);
    }
  }, [publication, selectedStyle]);

  const generateAllImages = useCallback(async () => {
    if (!publication) return;

    for (let i = 0; i < publication.phrases.length; i++) {
      if (!publication.phrases[i].imageUrl) {
        await generateImageForPhrase(i);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    toast.success("Todas las imágenes generadas");
  }, [publication, generateImageForPhrase]);

  const selectPhrase = useCallback((phrase: Phrase) => {
    setPublication(prev => prev ? { ...prev, selectedPhrase: phrase } : null);
  }, []);

  const savePublication = useCallback(async () => {
    if (!publication || !user) return null;

    try {
      const { data, error: saveError } = await supabase
        .from('daily_publications')
        .upsert({
          user_id: user.id,
          date: publication.date,
          phrases: publication.phrases,
          selected_phrase: publication.selectedPhrase,
          copy_short: publication.copyShort,
          copy_long: publication.copyLong,
          hashtags: publication.hashtags,
          published: publication.published,
        } as never, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();

      if (saveError) throw saveError;

      toast.success("Publicación guardada");
      return data;
    } catch (err) {
      console.error("Error saving publication:", err);
      toast.error("Error al guardar");
      return null;
    }
  }, [publication, user]);

  const markAsPublished = useCallback(async (platform: string) => {
    if (!publication || !user) return;

    try {
      await supabase
        .from('daily_publications')
        .upsert({
          user_id: user.id,
          date: publication.date,
          phrases: publication.phrases,
          selected_phrase: publication.selectedPhrase,
          copy_short: publication.copyShort,
          copy_long: publication.copyLong,
          hashtags: publication.hashtags,
          published: true,
          published_at: new Date().toISOString(),
          platform,
        } as never, {
          onConflict: 'user_id,date',
        });

      setPublication(prev => prev ? { ...prev, published: true } : null);
      toast.success("Marcado como publicado");
    } catch (err) {
      console.error("Error marking as published:", err);
    }
  }, [publication, user]);

  const copyToClipboard = useCallback((text: string, label: string = "Texto") => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }, []);

  const getTodaysPublication = useCallback(async () => {
    if (!user) return null;

    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from('daily_publications')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPublication({
          id: data.id,
          date: data.date,
          phrases: data.phrases as unknown as Phrase[],
          selectedPhrase: data.selected_phrase as unknown as Phrase | undefined,
          copyShort: data.copy_short || "",
          copyLong: data.copy_long || "",
          hashtags: data.hashtags || [],
          tipOfTheDay: "",
          published: data.published,
        });
        return data;
      }
      return null;
    } catch (err) {
      console.error("Error fetching publication:", err);
      return null;
    }
  }, [user]);

  return {
    publication,
    loading,
    generatingImage,
    selectedStyle,
    setSelectedStyle,
    error,
    generateContent,
    generateImageForPhrase,
    generateAllImages,
    selectPhrase,
    savePublication,
    markAsPublished,
    copyToClipboard,
    getTodaysPublication,
  };
};
