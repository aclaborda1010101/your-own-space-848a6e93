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
  { id: "premium_bg", name: "Premium" },
];

export const STORY_STYLES: ImageStyle[] = [
  { id: "premium_signature", name: "Premium Signature" },
];

export const useJarvisPublications = () => {
  const { user } = useAuth();
  const [publication, setPublication] = useState<DailyPublication | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [generatingStory, setGeneratingStory] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("bw_architecture");
  const [selectedStoryStyle, setSelectedStoryStyle] = useState<string>("premium_signature");
  const [error, setError] = useState<string | null>(null);

  const generateContent = useCallback(async (options?: {
    topic?: string;
    tone?: string;
    audience?: string;
    challengeName?: string;
    customImageStyle?: string;
    personalContext?: string;
  }) => {
    if (!user) {
      toast.error("Debes iniciar sesión");
      return null;
    }
    
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

      const today = getTodayLocal();
      const pub: DailyPublication = {
        date: today,
        phrases: data.phrases || [],
        copyShort: data.copyShort || "",
        copyLong: data.copyLong || "",
        hashtags: data.hashtags || [],
        tipOfTheDay: data.tipOfTheDay || "",
        published: false,
      };

      // Auto-save phrases to database immediately after generation
      const { data: savedData, error: saveError } = await supabase
        .from('daily_publications')
        .upsert({
          user_id: user.id,
          date: today,
          phrases: pub.phrases,
          copy_short: pub.copyShort,
          copy_long: pub.copyLong,
          hashtags: pub.hashtags,
          published: false,
        } as never, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();

      if (saveError) {
        console.error("Error auto-saving phrases:", saveError);
      } else if (savedData) {
        pub.id = savedData.id;
      }

      setPublication(pub);
      toast.success("Contenido generado y guardado", {
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
  }, [user]);

  const generateImageForPhrase = useCallback(async (
    phraseIndex: number, 
    style?: string,
    format: "square" | "story" = "square",
    customStyle?: string
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
          customImageStyle: customStyle,
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

  const regenerateImage = useCallback(async (phraseIndex: number, style?: string, customStyle?: string) => {
    return generateImageForPhrase(phraseIndex, style, "square", customStyle);
  }, [generateImageForPhrase]);

  const generateStoryImage = useCallback(async (
    phraseIndex: number, 
    storyStyle?: string,
    challengeDay?: number,
    challengeTotal?: number,
    displayTime?: string,
    customBackgroundUrl?: string
  ) => {
    if (!publication || !publication.phrases[phraseIndex]) return null;

    const phrase = publication.phrases[phraseIndex];
    const styleToUse = storyStyle || selectedStoryStyle;
    setGeneratingStory(phrase.category);

    try {
      // Prioritize Canvas API when ANY image is available (custom OR phrase image)
      const backgroundUrl = customBackgroundUrl || phrase.imageUrl;
      
      if (backgroundUrl) {
        console.log('[Story] Using background image:', backgroundUrl);
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        // Load and draw background image
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('[Story] Image loaded:', img.width, 'x', img.height);
            resolve(null);
          };
          img.onerror = (e) => {
            console.error('[Story] Image load error:', e);
            reject(new Error('Failed to load background image'));
          };
          img.src = backgroundUrl;
        });

        // Draw background (cover fit)
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        console.log('[Story] Background drawn');

        // Convert to grayscale (Nano Banana style)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;     // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
        }
        ctx.putImageData(imageData, 0, 0);
        console.log('[Story] Grayscale applied');

        // Dark overlay for readability (stronger than before)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        console.log('[Story] Dark overlay applied');

        // Use cyan accent color (Nano Banana style)
        const accentColor = '#00BFBF';

        // Draw time (top left, larger)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 60px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(displayTime || '00:00', 60, 110);

        // Draw challenge counter (top right, larger)
        ctx.textAlign = 'right';
        ctx.font = 'bold 48px -apple-system, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        const dayText = String(challengeDay || 1);
        const totalText = `/${challengeTotal || 180}`;
        const dayWidth = ctx.measureText(dayText).width;
        ctx.fillText(dayText, canvas.width - 60, 110);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 36px -apple-system, sans-serif';
        ctx.fillText(totalText, canvas.width - 60, 110);

        // Draw main phrase (center, larger like Nano Banana)
        ctx.textAlign = 'center';
        ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        
        const maxWidth = canvas.width - 100;
        const words = phrase.text.split(' ');
        let y_pos = 650;
        let currentLine = '';
        const phraseLines: string[] = [];
        
        // Word wrap
        words.forEach(word => {
          const testLine = currentLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine !== '') {
            phraseLines.push(currentLine.trim());
            currentLine = word + ' ';
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine.trim() !== '') {
          phraseLines.push(currentLine.trim());
        }

        // Draw phrase lines (centered)
        phraseLines.forEach((line, idx) => {
          // Highlight middle line with accent color
          if (idx === Math.floor(phraseLines.length / 2)) {
            ctx.fillStyle = accentColor;
          } else {
            ctx.fillStyle = '#FFFFFF';
          }
          ctx.fillText(line, canvas.width / 2, y_pos + (idx * 85));
        });
        
        console.log('[Story] Phrase drawn:', phraseLines.length, 'lines');

        // Draw reflection (below phrase, justified)
        ctx.font = '300 28px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'left';
        
        const reflectionWords = phrase.textLong.split(' ');
        let reflectionLine = '';
        let reflectionY = y_pos + (phraseLines.length * 85) + 100;
        let linesDrawn = 0;
        const maxReflectionLines = 12;
        const reflectionMaxWidth = canvas.width - 120;
        
        reflectionWords.forEach(word => {
          if (linesDrawn >= maxReflectionLines) return;
          
          const testLine = reflectionLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > reflectionMaxWidth && reflectionLine !== '') {
            ctx.fillText(reflectionLine.trim(), 60, reflectionY);
            reflectionLine = word + ' ';
            reflectionY += 42;
            linesDrawn++;
          } else {
            reflectionLine = testLine;
          }
        });
        
        if (reflectionLine.trim() !== '' && linesDrawn < maxReflectionLines && reflectionY < canvas.height - 150) {
          ctx.fillText(reflectionLine.trim(), 60, reflectionY);
          linesDrawn++;
        }
        
        console.log('[Story] Reflection drawn:', linesDrawn, 'lines');

        // Draw bottom signature (centered)
        ctx.font = '28px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('@agustinrubini', canvas.width / 2, canvas.height - 80);

        // Convert to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => {
            if (!b) throw new Error('Failed to create blob');
            console.log('[Story] Blob created:', (b.size / 1024).toFixed(2), 'KB');
            resolve(b);
          }, 'image/png', 1.0);
        });

        // Upload to Supabase storage
        if (!user) throw new Error("User not authenticated");
        
        const fileExt = 'png';
        const filePath = `${user.id}/stories/${Date.now()}.${fileExt}`;
        
        console.log('[Story] Uploading to:', filePath);
        
        const { error: uploadError } = await supabase.storage
          .from('content-backgrounds')
          .upload(filePath, blob);
        
        if (uploadError) {
          console.error('[Story] Upload error:', uploadError);
          throw uploadError;
        }
        
        const { data: urlData } = supabase.storage
          .from('content-backgrounds')
          .getPublicUrl(filePath);
        
        const imageUrl = urlData.publicUrl;
        console.log('[Story] Uploaded successfully:', imageUrl);
        
        setPublication(prev => {
          if (!prev) return null;
          const updatedPhrases = [...prev.phrases];
          updatedPhrases[phraseIndex] = {
            ...updatedPhrases[phraseIndex],
            storyImageUrl: imageUrl,
          };
          return { ...prev, phrases: updatedPhrases };
        });
        
        toast.success("Story creada", {
          description: customBackgroundUrl ? "Imagen 9:16 con tu foto personalizada" : "Imagen 9:16 lista para compartir"
        });
        
        return imageUrl;
      }
      
      // Fallback: Use Edge Function (generates AI background)
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-publications', {
        body: {
          action: 'generate-story',
          phraseText: phrase.text,
          reflection: phrase.textLong,
          phraseCategory: phrase.category,
          storyStyle: styleToUse,
          baseImageUrl: phrase.imageUrl,
          challengeDay,
          challengeTotal,
          displayTime,
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
  }, [publication, selectedStoryStyle, user]);

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
    setPublication,
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
