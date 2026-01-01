import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getTodayLocal } from "@/lib/dateUtils";

export interface Phrase {
  category: string;
  text: string;
  textLong: string;
  cta?: string;
  imageUrl?: string;
  imageStyle?: string;
  storyImageUrl?: string;
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
  { id: "bw_architecture", name: "Arquitectura B/N" },
  { id: "bw_landscape", name: "Paisaje B/N" },
  { id: "bw_abstract", name: "Abstracto B/N" },
  { id: "bw_minimal", name: "Minimalista B/N" },
  { id: "bw_urban", name: "Urbano B/N" },
  { id: "color_nature", name: "Naturaleza Color" },
];

export const STORY_STYLES: ImageStyle[] = [
  { id: "bw_elegant", name: "B/N Elegante" },
  { id: "bw_bold", name: "B/N Impactante" },
  { id: "bw_paper", name: "Papel Arrugado B/N" },
  { id: "neon_fluor", name: "Neón Minimalista" },
  { id: "sunset_warm", name: "Atardecer Moderno" },
  { id: "minimal_white", name: "Blanco Minimal" },
  { id: "vintage_type", name: "Tipografía Vintage" },
  { id: "gradient_modern", name: "Gradiente Moderno" },
];

export const useJarvisPublications = () => {
  const { user } = useAuth();
  const [publication, setPublication] = useState<DailyPublication | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [generatingStory, setGeneratingStory] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("bw_architecture");
  const [selectedStoryStyle, setSelectedStoryStyle] = useState<string>("bw_elegant");
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
        date: getTodayLocal(),
        phrases: data.phrases || [],
        copyShort: data.copyShort || "",
        copyLong: data.copyLong || "",
        hashtags: data.hashtags || [],
        tipOfTheDay: data.tipOfTheDay || "",
        published: false,
      };

      setPublication(pub);
      toast.success("Contenido generado", {
        description: "Selecciona una frase y genera su imagen"
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

  const generateImageForPhrase = useCallback(async (
    phraseIndex: number, 
    style?: string,
    format: "square" | "story" = "square"
  ) => {
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
          format,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.imageUrl) {
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

  const regenerateImage = useCallback(async (phraseIndex: number, style?: string) => {
    return generateImageForPhrase(phraseIndex, style);
  }, [generateImageForPhrase]);

  const generateStoryImage = useCallback(async (
    phraseIndex: number, 
    storyStyle?: string,
    challengeDay?: number,
    challengeTotal?: number
  ) => {
    if (!publication || !publication.phrases[phraseIndex]) return null;

    const phrase = publication.phrases[phraseIndex];
    const styleToUse = storyStyle || selectedStoryStyle;
    setGeneratingStory(phrase.category);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-publications', {
        body: {
          action: 'generate-story',
          phraseText: phrase.text,
          reflection: phrase.textLong,
          phraseCategory: phrase.category,
          storyStyle: styleToUse,
          baseImageUrl: phrase.imageUrl, // Use existing image if available
          challengeDay,
          challengeTotal,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.imageUrl) {
        setPublication(prev => {
          if (!prev) return null;
          const updatedPhrases = [...prev.phrases];
          updatedPhrases[phraseIndex] = {
            ...updatedPhrases[phraseIndex],
            storyImageUrl: data.imageUrl,
          };
          return { ...prev, phrases: updatedPhrases };
        });
        
        toast.success("Story creada", {
          description: "Imagen 9:16 con tipografía creativa lista"
        });
        
        return data.imageUrl;
      }
      
      throw new Error("No se pudo generar la story");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al generar story";
      console.error("Story generation error:", err);
      toast.error("Error al generar story", { description: message });
      return null;
    } finally {
      setGeneratingStory(null);
    }
  }, [publication, selectedStoryStyle]);

  // Share to Instagram (opens Instagram with image copied to clipboard)
  const shareToInstagram = useCallback(async (imageUrl: string) => {
    try {
      // Try Web Share API first (works on mobile)
      if (navigator.share && navigator.canShare) {
        // Convert base64 to blob if needed
        let blob: Blob;
        if (imageUrl.startsWith('data:')) {
          const response = await fetch(imageUrl);
          blob = await response.blob();
        } else {
          const response = await fetch(imageUrl);
          blob = await response.blob();
        }
        
        const file = new File([blob], 'story.png', { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Mi Story',
          });
          toast.success("Abriendo compartir...");
          return;
        }
      }
      
      // Fallback: Download image only (don't try to open instagram.com - blocked by CSP)
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `jarvis-story-${getTodayLocal()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Imagen descargada", {
        description: "Abre Instagram en tu móvil y súbela a tu Story",
        duration: 5000,
      });
    } catch (err) {
      console.error("Share error:", err);
      toast.error("Error al compartir", {
        description: "Descarga la imagen manualmente"
      });
    }
  }, []);

  const generateAllImages = useCallback(async () => {
    if (!publication) return;

    for (let i = 0; i < publication.phrases.length; i++) {
      if (!publication.phrases[i].imageUrl) {
        await generateImageForPhrase(i);
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
      const today = getTodayLocal();
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

  const downloadImage = useCallback((imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagen descargada");
  }, []);

  return {
    publication,
    loading,
    generatingImage,
    generatingStory,
    selectedStyle,
    setSelectedStyle,
    selectedStoryStyle,
    setSelectedStoryStyle,
    error,
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
    downloadImage,
    IMAGE_STYLES,
    STORY_STYLES,
  };
};
