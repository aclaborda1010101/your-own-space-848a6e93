import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVITY_TEMPLATES = {
  juego_vinculo: [
    { 
      title: "Historias encadenadas", 
      description: "Cada uno añade una frase a la historia. Bosco empieza y tú sigues. El objetivo es crear una historia absurda y divertida juntos, fomentando la creatividad y el vínculo.", 
      instructions: "1. Siéntate cómodo con Bosco\n2. Dile: 'Vamos a inventar una historia loca, tú dices una frase y yo sigo'\n3. Déjale empezar con lo que quiera\n4. Añade algo inesperado para hacerle reír\n5. Continúa hasta que la historia tenga un final",
      language: "es", 
      duration: 20, 
      energy_level: "medium" 
    },
    { 
      title: "Story chain game", 
      description: "Take turns adding sentences to a story using simple English words. Great for introducing new vocabulary in a fun context.", 
      instructions: "1. Start with 'Once upon a time...'\n2. Keep sentences short: 5-7 words max\n3. Use words Bosco already knows\n4. Add gestures to help understanding\n5. Celebrate his contributions",
      language: "en", 
      duration: 15, 
      energy_level: "medium" 
    },
    { 
      title: "El juego del ¿por qué?", 
      description: "Preguntas abiertas sobre cualquier tema que le interese. Desarrolla pensamiento crítico y curiosidad sin presión.", 
      instructions: "1. Observa qué le llama la atención en ese momento\n2. Pregunta '¿Por qué crees que...?'\n3. Acepta cualquier respuesta sin corregir\n4. Sigue preguntando '¿Y por qué...?' suavemente\n5. Comparte tus propias teorías locas también",
      language: "es", 
      duration: 15, 
      energy_level: "low" 
    },
    { 
      title: "Construcciones con explicación", 
      description: "Construir algo juntos con bloques, Lego o lo que haya, explicando en voz alta qué es y para qué sirve. Desarrolla vocabulario y planificación.", 
      instructions: "1. Saca los materiales de construcción\n2. Pregunta '¿Qué vamos a construir?'\n3. Mientras construyes, narra: 'Ahora pongo esta pieza aquí porque...'\n4. Pídele que te explique sus decisiones\n5. Al final, haced un tour por la creación",
      language: "mixed", 
      duration: 25, 
      energy_level: "medium" 
    },
    { 
      title: "Dibujo colaborativo", 
      description: "Turnos para añadir elementos al dibujo. Uno dibuja algo, el otro añade. Nombrar cada cosa refuerza vocabulario y creatividad compartida.", 
      instructions: "1. Coged un papel grande y rotuladores\n2. Tú dibujas algo simple (sol, casa...)\n3. Bosco añade algo\n4. Nombrad cada cosa que se añade\n5. Inventad una historia sobre el dibujo final",
      language: "mixed", 
      duration: 20, 
      energy_level: "low" 
    },
  ],
  lectura: [
    { 
      title: "Lectura + dibujo", 
      description: "Leer 5-10 minutos un cuento corto y después Bosco dibuja lo que más le gustó o lo que entendió. Refuerza comprensión y expresión.", 
      instructions: "1. Elige un cuento corto con ilustraciones\n2. Lee despacio, con voces si puedes\n3. Para en las partes emocionantes\n4. Al acabar: '¿Qué dibujarías de esta historia?'\n5. Mientras dibuja, habla sobre el cuento",
      language: "es", 
      duration: 15, 
      energy_level: "low" 
    },
    { 
      title: "Cambia el final", 
      description: "Leer un cuento conocido y que Bosco invente otro final. Fomenta creatividad y pensamiento alternativo.", 
      instructions: "1. Elige un cuento que ya conozca\n2. Léelo hasta casi el final\n3. Para y pregunta: '¿Qué crees que pasa ahora?'\n4. Deja que invente libremente\n5. Celebra su versión como válida",
      language: "es", 
      duration: 15, 
      energy_level: "low" 
    },
    { 
      title: "Picture book in English", 
      description: "Usar un libro con muchas ilustraciones. Señalar objetos y acciones, repetir palabras simples en inglés. Sin presión de entender todo.", 
      instructions: "1. Elige un libro con ilustraciones claras\n2. No leas el texto, describe las imágenes\n3. 'Look! A big red ball!' (señala)\n4. Espera a que repita o reaccione\n5. Si no quiere inglés, cambia a español",
      language: "en", 
      duration: 10, 
      energy_level: "low" 
    },
    { 
      title: "Lectura con preguntas", 
      description: "Parar cada 2 páginas y hacer una pregunta sobre lo leído. Desarrolla atención y comprensión activa.", 
      instructions: "1. Avisa: 'Voy a hacerte preguntas fáciles'\n2. Lee 2 páginas con calma\n3. Pregunta algo concreto: '¿De qué color era...?'\n4. Si no sabe, volved a mirar juntos\n5. Nunca es un examen, es un juego",
      language: "es", 
      duration: 20, 
      energy_level: "low" 
    },
  ],
  ingles_ludico: [
    { 
      title: "Treasure Hunt", 
      description: "Buscar objetos por casa siguiendo pistas en inglés. 'Find the red car', 'Find something blue'. Movimiento + vocabulario.", 
      instructions: "1. Piensa 5-6 objetos fáciles de encontrar\n2. Da pistas simples: 'Find something [color/size]'\n3. Usa gestos si no entiende\n4. Celebra cada hallazgo: 'Yes! You found it!'\n5. Déjale que te dé pistas a ti también",
      language: "en", 
      duration: 15, 
      energy_level: "high" 
    },
    { 
      title: "Simon Says", 
      description: "El clásico juego de instrucciones. Solo hacer la acción si dices 'Simon says'. Perfecto para verbos de acción en inglés.", 
      instructions: "1. Explica la regla: 'Solo si digo Simon says'\n2. Empieza fácil: 'Simon says jump!'\n3. Mezcla con trampas: 'Touch your nose!' (sin Simon says)\n4. Déjale ser Simon también\n5. Usa acciones que conozca: jump, run, sit, clap",
      language: "en", 
      duration: 10, 
      energy_level: "high" 
    },
    { 
      title: "Canciones con gestos", 
      description: "Cantar canciones infantiles en inglés haciendo los gestos correspondientes. La música facilita la memoria.", 
      instructions: "1. Pon una canción conocida (Head shoulders, Wheels on the bus...)\n2. Haz los gestos exageradamente\n3. No importa si no canta todo\n4. Repite las que más le gusten\n5. 2-3 canciones máximo para no saturar",
      language: "en", 
      duration: 10, 
      energy_level: "medium" 
    },
    { 
      title: "Color hunt", 
      description: "Buscar y nombrar colores en inglés por la casa. Simple y efectivo para reforzar vocabulario básico.", 
      instructions: "1. Elige un color: 'Let's find red things!'\n2. Corred juntos buscando\n3. Nombra cada cosa: 'Red apple! Red car!'\n4. Cambia de color cuando pierda interés\n5. Máximo 3-4 colores por sesión",
      language: "en", 
      duration: 10, 
      energy_level: "medium" 
    },
    { 
      title: "Body parts game", 
      description: "Señalar partes del cuerpo mientras las nombras en inglés. Combina con 'Head, shoulders, knees and toes'.", 
      instructions: "1. Empieza con las que conoce: head, eyes, nose\n2. Tócate la parte mientras la dices\n3. 'Touch your... nose!' (espera)\n4. Añade partes nuevas poco a poco\n5. Termina con la canción si la sabe",
      language: "en", 
      duration: 10, 
      energy_level: "medium" 
    },
  ],
  ia_ninos: [
    { 
      title: "La máquina que pregunta", 
      description: "Tú haces de 'robot' o 'máquina' que no sabe nada y Bosco te enseña. Invertir roles desarrolla confianza y expresión.", 
      instructions: "1. Di con voz de robot: 'Soy un robot. No sé nada'\n2. Pregunta cosas obvias: '¿Qué es eso redondo?'\n3. Celebra sus respuestas: 'Procesando... ¡Aprendido!'\n4. Hazle preguntas cada vez más tontas\n5. Déjale que sea el robot un rato",
      language: "es", 
      duration: 15, 
      energy_level: "medium" 
    },
    { 
      title: "Historias con reglas", 
      description: "Crear una historia donde el 'robot' (tú) solo puede decir 3 palabras cada vez. Enseña limitaciones y creatividad dentro de reglas.", 
      instructions: "1. Explica: 'Soy un robot roto, solo puedo decir 3 palabras'\n2. Bosco cuenta la historia\n3. Tú solo añades 3 palabras por turno\n4. Haz que sea gracioso y difícil\n5. Cambiad roles si quiere",
      language: "es", 
      duration: 15, 
      energy_level: "medium" 
    },
    { 
      title: "¿Qué va junto?", 
      description: "Clasificar objetos, juguetes o imágenes y explicar por qué van juntos. Base del pensamiento lógico y categorización.", 
      instructions: "1. Junta varios objetos o juguetes\n2. Pregunta: '¿Cuáles van juntos?'\n3. Acepta cualquier criterio: color, uso, forma\n4. Pregunta siempre: '¿Por qué?'\n5. Propón agrupaciones absurdas para reír",
      language: "es", 
      duration: 10, 
      energy_level: "low" 
    },
    { 
      title: "Si esto, entonces...", 
      description: "Juego de causa-efecto. 'Si llueve, entonces...' Bosco completa. Desarrolla pensamiento consecuencial.", 
      instructions: "1. Empieza fácil: 'Si llueve, entonces...'\n2. Acepta respuestas lógicas y locas\n3. Haz algunas absurdas: 'Si como helado, entonces...'\n4. Déjale que te haga 'Si...' a ti\n5. No corrijas, solo explora",
      language: "es", 
      duration: 10, 
      energy_level: "low" 
    },
  ],
  movimiento: [
    { 
      title: "Circuito casero", 
      description: "Crear un mini circuito por casa: saltar un cojín, gatear bajo la mesa, equilibrio en una línea. Descarga energía con propósito.", 
      instructions: "1. Prepara 4-5 estaciones simples\n2. Demuestra el circuito una vez\n3. Hazlo juntos la primera ronda\n4. Déjale repetir solo\n5. Cambia una estación si se aburre",
      language: "mixed", 
      duration: 20, 
      energy_level: "high" 
    },
    { 
      title: "Baile guiado", 
      description: "Bailar juntos siguiendo instrucciones o imitándose. Música alegre y movimiento libre.", 
      instructions: "1. Pon música que le guste\n2. Empieza con movimientos simples\n3. 'Ahora hacemos como yo' / 'Now you lead'\n4. Mezcla español e inglés en instrucciones\n5. Termina con una canción tranquila",
      language: "mixed", 
      duration: 15, 
      energy_level: "high" 
    },
    { 
      title: "Retos de equilibrio", 
      description: "Mantener equilibrio en un pie, caminar en línea recta, llevar algo en la cabeza. Concentración + cuerpo.", 
      instructions: "1. Empieza fácil: equilibrio en un pie 5 segundos\n2. Haz una línea con cinta en el suelo\n3. Añade dificultad: ojos cerrados, libro en la cabeza\n4. Hazlo tú también para que vea\n5. Nunca es competición, es juego",
      language: "es", 
      duration: 10, 
      energy_level: "medium" 
    },
    { 
      title: "Freeze dance", 
      description: "Bailar y congelarse cuando para la música. Clásico que trabaja atención y control corporal.", 
      instructions: "1. Explica: 'Cuando pare la música, ¡estatua!'\n2. Pon música movida\n3. Para de repente\n4. Exagera tu congelación para hacerle reír\n5. Déjale controlar la música a veces",
      language: "en", 
      duration: 15, 
      energy_level: "high" 
    },
    { 
      title: "Animal movements", 
      description: "Moverse como diferentes animales: jump like a frog, walk like a bear, fly like a bird. Vocabulario + movimiento.", 
      instructions: "1. Di: 'Let's move like animals!'\n2. Empieza: 'Jump like a frog!' (salta tú también)\n3. Usa animales conocidos: frog, bear, bird, snake\n4. Pregunta: 'What animal now?'\n5. Deja que elija y te enseñe",
      language: "en", 
      duration: 15, 
      energy_level: "high" 
    },
  ],
  cierre_dia: [
    { 
      title: "Lo mejor de hoy", 
      description: "Compartir cada uno qué fue lo mejor del día. Ritual de cierre que refuerza lo positivo.", 
      instructions: "1. Hazlo siempre a la misma hora\n2. Tú compartes primero para dar ejemplo\n3. Acepta cualquier respuesta\n4. No juzgues ni compares\n5. Un abrazo al final",
      language: "es", 
      duration: 5, 
      energy_level: "low" 
    },
    { 
      title: "Una cosa nueva", 
      description: "Cada uno dice algo nuevo que aprendió hoy. Fomenta curiosidad y reflexión.", 
      instructions: "1. Pregunta: '¿Qué aprendiste hoy?'\n2. Comparte tú algo también\n3. Vale cualquier cosa: un color, una palabra, un truco\n4. Celebra su aprendizaje\n5. Si no sabe, ayúdale a recordar el día",
      language: "es", 
      duration: 5, 
      energy_level: "low" 
    },
    { 
      title: "¿Qué hacemos mañana?", 
      description: "Planear algo divertido para mañana juntos. Crea anticipación positiva.", 
      instructions: "1. Pregunta: '¿Qué te gustaría hacer mañana?'\n2. Propón opciones si no sabe\n3. Elige algo realista que podáis cumplir\n4. Haz una 'promesa' simple\n5. Mañana, recuérdale que lo cumplisteis",
      language: "es", 
      duration: 5, 
      energy_level: "low" 
    },
  ],
};

// Vocabulary word suggestions for 4.5 year olds
const VOCABULARY_SUGGESTIONS = {
  animales: [
    { en: "dog", es: "perro" }, { en: "cat", es: "gato" }, { en: "bird", es: "pájaro" },
    { en: "fish", es: "pez" }, { en: "rabbit", es: "conejo" }, { en: "horse", es: "caballo" },
    { en: "cow", es: "vaca" }, { en: "pig", es: "cerdo" }, { en: "chicken", es: "pollo" },
    { en: "duck", es: "pato" }, { en: "frog", es: "rana" }, { en: "bear", es: "oso" },
    { en: "lion", es: "león" }, { en: "elephant", es: "elefante" }, { en: "monkey", es: "mono" },
    { en: "snake", es: "serpiente" }, { en: "turtle", es: "tortuga" }, { en: "butterfly", es: "mariposa" },
  ],
  colores: [
    { en: "red", es: "rojo" }, { en: "blue", es: "azul" }, { en: "green", es: "verde" },
    { en: "yellow", es: "amarillo" }, { en: "orange", es: "naranja" }, { en: "purple", es: "morado" },
    { en: "pink", es: "rosa" }, { en: "black", es: "negro" }, { en: "white", es: "blanco" },
    { en: "brown", es: "marrón" }, { en: "gray", es: "gris" },
  ],
  numeros: [
    { en: "one", es: "uno" }, { en: "two", es: "dos" }, { en: "three", es: "tres" },
    { en: "four", es: "cuatro" }, { en: "five", es: "cinco" }, { en: "six", es: "seis" },
    { en: "seven", es: "siete" }, { en: "eight", es: "ocho" }, { en: "nine", es: "nueve" },
    { en: "ten", es: "diez" },
  ],
  comida: [
    { en: "apple", es: "manzana" }, { en: "banana", es: "plátano" }, { en: "bread", es: "pan" },
    { en: "milk", es: "leche" }, { en: "water", es: "agua" }, { en: "cheese", es: "queso" },
    { en: "egg", es: "huevo" }, { en: "rice", es: "arroz" }, { en: "chicken", es: "pollo" },
    { en: "fish", es: "pescado" }, { en: "orange", es: "naranja" }, { en: "strawberry", es: "fresa" },
    { en: "cookie", es: "galleta" }, { en: "cake", es: "pastel" }, { en: "ice cream", es: "helado" },
  ],
  cuerpo: [
    { en: "head", es: "cabeza" }, { en: "eyes", es: "ojos" }, { en: "nose", es: "nariz" },
    { en: "mouth", es: "boca" }, { en: "ears", es: "orejas" }, { en: "hands", es: "manos" },
    { en: "feet", es: "pies" }, { en: "arms", es: "brazos" }, { en: "legs", es: "piernas" },
    { en: "fingers", es: "dedos" }, { en: "tummy", es: "barriga" }, { en: "hair", es: "pelo" },
  ],
  acciones: [
    { en: "run", es: "correr" }, { en: "jump", es: "saltar" }, { en: "walk", es: "caminar" },
    { en: "eat", es: "comer" }, { en: "drink", es: "beber" }, { en: "sleep", es: "dormir" },
    { en: "play", es: "jugar" }, { en: "read", es: "leer" }, { en: "sing", es: "cantar" },
    { en: "dance", es: "bailar" }, { en: "swim", es: "nadar" }, { en: "fly", es: "volar" },
    { en: "sit", es: "sentarse" }, { en: "stand", es: "estar de pie" }, { en: "clap", es: "aplaudir" },
  ],
  casa: [
    { en: "house", es: "casa" }, { en: "door", es: "puerta" }, { en: "window", es: "ventana" },
    { en: "bed", es: "cama" }, { en: "chair", es: "silla" }, { en: "table", es: "mesa" },
    { en: "kitchen", es: "cocina" }, { en: "bathroom", es: "baño" }, { en: "garden", es: "jardín" },
    { en: "car", es: "coche" }, { en: "ball", es: "pelota" }, { en: "book", es: "libro" },
    { en: "toy", es: "juguete" }, { en: "television", es: "televisión" }, { en: "phone", es: "teléfono" },
  ],
  familia: [
    { en: "mom", es: "mamá" }, { en: "dad", es: "papá" }, { en: "brother", es: "hermano" },
    { en: "sister", es: "hermana" }, { en: "grandma", es: "abuela" }, { en: "grandpa", es: "abuelo" },
    { en: "baby", es: "bebé" }, { en: "family", es: "familia" }, { en: "friend", es: "amigo" },
  ],
  ropa: [
    { en: "shirt", es: "camiseta" }, { en: "pants", es: "pantalones" }, { en: "shoes", es: "zapatos" },
    { en: "socks", es: "calcetines" }, { en: "hat", es: "gorro" }, { en: "jacket", es: "chaqueta" },
    { en: "dress", es: "vestido" }, { en: "pajamas", es: "pijama" },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activityType, existingActivities = [], generateVocabulary = false, existingWords = [] } = await req.json();
    console.log('Request:', { activityType, generateVocabulary });

    // Generate vocabulary suggestions
    if (generateVocabulary) {
      const allWords: { en: string; es: string; category: string }[] = [];
      
      for (const [category, words] of Object.entries(VOCABULARY_SUGGESTIONS)) {
        for (const word of words) {
          // Filter out words that already exist
          if (!existingWords.some((ew: string) => ew.toLowerCase() === word.en.toLowerCase())) {
            allWords.push({ ...word, category });
          }
        }
      }

      // Shuffle and take 30
      const shuffled = allWords.sort(() => Math.random() - 0.5);
      const suggestions = shuffled.slice(0, 30);

      console.log('Generated vocabulary suggestions:', suggestions.length);
      return new Response(
        JSON.stringify({ vocabulary: suggestions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate activities
    let activities: any[] = [];

    if (activityType === 'all') {
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

    console.log('Generated activities:', activities.length);

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

