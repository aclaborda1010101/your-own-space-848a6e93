import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVITY_TEMPLATES = {
  juego_vinculo: [
    { title: "Historias encadenadas", description: "Cada uno añade una frase a la historia. Bosco empieza.", language: "es", duration: 20, energy_level: "medium" },
    { title: "Story chain game", description: "Take turns adding sentences to a story. Simple English words.", language: "en", duration: 15, energy_level: "medium" },
    { title: "El juego del ¿por qué?", description: "Preguntas abiertas sobre cualquier tema que le interese.", language: "es", duration: 15, energy_level: "low" },
    { title: "Construcciones con explicación", description: "Construir algo juntos y explicar qué es en voz alta.", language: "mixed", duration: 25, energy_level: "medium" },
    { title: "Dibujo colaborativo", description: "Turnos para añadir elementos al dibujo. Nombrar cada cosa.", language: "mixed", duration: 20, energy_level: "low" },
  ],
  lectura: [
    { title: "Lectura + dibujo", description: "Leer 5-10 min y que Bosco dibuje lo que entendió.", language: "es", duration: 15, energy_level: "low" },
    { title: "Cambia el final", description: "Leer un cuento corto y que Bosco invente otro final.", language: "es", duration: 15, energy_level: "low" },
    { title: "Picture book in English", description: "Señalar objetos y acciones, repetir palabras simples.", language: "en", duration: 10, energy_level: "low" },
    { title: "Lectura con preguntas", description: "Parar cada 2 páginas y hacer una pregunta sobre lo leído.", language: "es", duration: 20, energy_level: "low" },
  ],
  ingles_ludico: [
    { title: "Treasure Hunt", description: "Buscar objetos por casa: 'Find the red car', 'Find something blue'.", language: "en", duration: 15, energy_level: "high" },
    { title: "Simon Says", description: "Jugar a Simon Says con acciones simples.", language: "en", duration: 10, energy_level: "high" },
    { title: "Canciones con gestos", description: "Cantar canciones infantiles en inglés con movimientos.", language: "en", duration: 10, energy_level: "medium" },
    { title: "Color hunt", description: "Buscar y nombrar colores en inglés por la casa.", language: "en", duration: 10, energy_level: "medium" },
    { title: "Body parts game", description: "Señalar partes del cuerpo mientras las nombras en inglés.", language: "en", duration: 10, energy_level: "medium" },
  ],
  ia_ninos: [
    { title: "La máquina que pregunta", description: "Tú haces de 'robot' y Bosco te enseña cosas. Preguntas simples.", language: "es", duration: 15, energy_level: "medium" },
    { title: "Historias con reglas", description: "Crear una historia donde el 'robot' solo puede decir 3 palabras.", language: "es", duration: 15, energy_level: "medium" },
    { title: "¿Qué va junto?", description: "Clasificar objetos o imágenes y explicar por qué van juntos.", language: "es", duration: 10, energy_level: "low" },
    { title: "Si esto, entonces...", description: "Juego de causa-efecto: 'Si llueve, entonces...'", language: "es", duration: 10, energy_level: "low" },
  ],
  movimiento: [
    { title: "Circuito casero", description: "Crear un mini circuito: saltar, gatear, equilibrio.", language: "mixed", duration: 20, energy_level: "high" },
    { title: "Baile guiado", description: "Bailar juntos siguiendo instrucciones o imitándose.", language: "mixed", duration: 15, energy_level: "high" },
    { title: "Retos de equilibrio", description: "Mantener equilibrio en un pie, caminar en línea recta.", language: "es", duration: 10, energy_level: "medium" },
    { title: "Freeze dance", description: "Bailar y congelarse cuando para la música.", language: "en", duration: 15, energy_level: "high" },
    { title: "Animal movements", description: "Moverse como diferentes animales: jump like a frog, walk like a bear.", language: "en", duration: 15, energy_level: "high" },
  ],
  cierre_dia: [
    { title: "Lo mejor de hoy", description: "Compartir cada uno qué fue lo mejor del día.", language: "es", duration: 5, energy_level: "low" },
    { title: "Una cosa nueva", description: "Cada uno dice algo nuevo que aprendió hoy.", language: "es", duration: 5, energy_level: "low" },
    { title: "¿Qué hacemos mañana?", description: "Planear algo divertido para mañana juntos.", language: "es", duration: 5, energy_level: "low" },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activityType, existingActivities = [] } = await req.json();
    console.log('Generating activities for type:', activityType);
    console.log('Existing activities:', existingActivities);

    let activities: any[] = [];

    if (activityType === 'all') {
      // Generate one activity per type (except cierre_dia which is always the same)
      const types = ['juego_vinculo', 'lectura', 'ingles_ludico', 'movimiento'];
      
      for (const type of types) {
        const templates = ACTIVITY_TEMPLATES[type as keyof typeof ACTIVITY_TEMPLATES];
        const available = templates.filter(t => !existingActivities.includes(t.title));
        if (available.length > 0) {
          const selected = available[Math.floor(Math.random() * available.length)];
          activities.push({ ...selected, type });
        }
      }
    } else if (activityType && ACTIVITY_TEMPLATES[activityType as keyof typeof ACTIVITY_TEMPLATES]) {
      const templates = ACTIVITY_TEMPLATES[activityType as keyof typeof ACTIVITY_TEMPLATES];
      const available = templates.filter(t => !existingActivities.includes(t.title));
      if (available.length > 0) {
        const selected = available[Math.floor(Math.random() * available.length)];
        activities.push({ ...selected, type: activityType });
      }
    }

    console.log('Generated activities:', activities);

    return new Response(
      JSON.stringify({ activities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in bosco-activities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
