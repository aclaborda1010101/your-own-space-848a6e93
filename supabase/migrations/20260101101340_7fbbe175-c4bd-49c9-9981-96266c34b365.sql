-- Historial de comidas seleccionadas
CREATE TABLE public.meal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_name TEXT NOT NULL,
  recipe_data JSONB,
  was_completed BOOLEAN DEFAULT false,
  energy_after INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lista de compra
CREATE TABLE public.shopping_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Perfil de nutrición extendido con reglas JARVIS
CREATE TABLE public.nutrition_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Preferencias generales
  eating_style TEXT DEFAULT 'simple_repetible',
  max_complexity TEXT DEFAULT 'baja',
  decision_fatigue TEXT DEFAULT 'alta',
  intermittent_fasting BOOLEAN DEFAULT true,
  -- Horarios
  first_meal_time TIME DEFAULT '11:00',
  main_meal_time TIME DEFAULT '14:00',
  dinner_time TIME DEFAULT '21:00',
  -- Alimentos clasificados
  preferred_foods JSONB DEFAULT '["carne", "pasta", "arroz_blanco", "embutido", "atun", "lechuga", "cremas_de_verduras_suaves"]',
  tolerated_foods JSONB DEFAULT '["huevo", "queso", "yogur_natural", "tomate"]',
  rejected_foods JSONB DEFAULT '["tofu", "curry", "espinacas", "cebolla", "pimientos", "garbanzos", "boniato", "esparragos", "quinoa", "brocoli", "bacalao", "coliflor", "calabaza", "verduras_como_plato_principal"]',
  -- Dieta y entrenamiento
  active_diet TEXT DEFAULT 'equilibrada_simple',
  training_frequency TEXT DEFAULT 'regular',
  training_type TEXT DEFAULT 'fuerza',
  -- Objetivo
  nutritional_goal TEXT DEFAULT 'energia_estable',
  -- Reglas personales
  personal_rules JSONB DEFAULT '["nunca_innovar_en_dias_de_estres", "max_3_opciones_por_comida", "evitar_recetas_instagram"]',
  -- Suplementos
  supplements JSONB DEFAULT '[{"name": "Creatina", "dose": "diaria", "moment": "post_entreno", "alarm": true}, {"name": "Omega 3", "dose": "diaria", "moment": "comida_principal", "alarm": true}, {"name": "Magnesio", "dose": "diaria", "moment": "noche", "alarm": true}]',
  -- Plantillas de menú
  menu_templates JSONB DEFAULT '{"normal": {"breakfast": "Atún + lechuga + aceite", "lunch": "Carne + arroz blanco", "dinner": "Crema suave + embutido"}, "keto": {"breakfast": "Huevos + embutido", "lunch": "Carne + queso", "dinner": "Atún o tortilla francesa"}, "stress": {"breakfast": "Atún solo", "lunch": "Plato repetido favorito", "dinner": "Cena ligera sin pensar"}}',
  -- Patrones aprendidos
  learned_patterns JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Registro de suplementos tomados
CREATE TABLE public.supplement_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplement_name TEXT NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Habilitar RLS
ALTER TABLE public.meal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;

-- Políticas meal_history
CREATE POLICY "Users can view own meal history" ON public.meal_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal history" ON public.meal_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal history" ON public.meal_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal history" ON public.meal_history FOR DELETE USING (auth.uid() = user_id);

-- Políticas shopping_list
CREATE POLICY "Users can view own shopping list" ON public.shopping_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shopping list" ON public.shopping_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping list" ON public.shopping_list FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping list" ON public.shopping_list FOR DELETE USING (auth.uid() = user_id);

-- Políticas nutrition_profile
CREATE POLICY "Users can view own nutrition profile" ON public.nutrition_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition profile" ON public.nutrition_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition profile" ON public.nutrition_profile FOR UPDATE USING (auth.uid() = user_id);

-- Políticas supplement_logs
CREATE POLICY "Users can view own supplement logs" ON public.supplement_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own supplement logs" ON public.supplement_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own supplement logs" ON public.supplement_logs FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_shopping_list_updated_at BEFORE UPDATE ON public.shopping_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nutrition_profile_updated_at BEFORE UPDATE ON public.nutrition_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();