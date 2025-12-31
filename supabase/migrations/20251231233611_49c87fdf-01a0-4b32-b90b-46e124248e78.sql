-- Tabla USER_PROFILE: Fuente única de verdad para JARVIS
CREATE TABLE public.user_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  -- IDENTIDAD
  name TEXT,
  vital_role TEXT, -- 'Emprendedor creativo, padre, marido'
  current_context TEXT, -- 'Alta carga profesional + responsabilidad familiar'
  cognitive_style TEXT, -- 'Analítico-creativo, alta autoexigencia'
  primary_language TEXT DEFAULT 'es',
  secondary_language TEXT DEFAULT 'en',
  
  -- PRINCIPIOS PERSONALES (JSONB para flexibilidad)
  personal_principles JSONB DEFAULT '[]'::jsonb,
  
  -- OBJETIVOS
  life_goals JSONB DEFAULT '[]'::jsonb, -- Objetivos vitales
  professional_goals JSONB DEFAULT '[]'::jsonb, -- Objetivos profesionales
  
  -- CONTEXTO FAMILIAR
  family_context JSONB DEFAULT '{}'::jsonb, -- Hijos, prioridades familiares
  
  -- SALUD Y ENERGÍA
  health_profile JSONB DEFAULT '{}'::jsonb, -- Entrena, descanso, tolerancia a carga
  
  -- ALIMENTACIÓN
  food_preferences JSONB DEFAULT '{}'::jsonb, -- Dieta preferida, alimentos rechazados
  food_dislikes JSONB DEFAULT '[]'::jsonb, -- Lista de alimentos que NO le gustan
  
  -- HORARIOS Y RITMO
  best_focus_time TEXT DEFAULT 'morning', -- 'morning', 'afternoon', 'evening'
  fatigue_time TEXT DEFAULT 'afternoon',
  needs_buffers BOOLEAN DEFAULT true,
  
  -- ESTILO DE COMUNICACIÓN
  communication_style JSONB DEFAULT '{}'::jsonb, -- Directo, humano, sin hype
  
  -- REGLAS PERSONALES EXPLÍCITAS
  personal_rules JSONB DEFAULT '[]'::jsonb, -- Max 3 prioridades, no reuniones innecesarias, etc.
  
  -- DECISIONES AUTOMÁTICAS vs CONFIRMACIÓN
  auto_decisions JSONB DEFAULT '[]'::jsonb, -- Lo que JARVIS puede hacer solo
  require_confirmation JSONB DEFAULT '[]'::jsonb, -- Lo que requiere confirmación
  
  -- PATRONES APRENDIDOS (se actualiza con el uso)
  learned_patterns JSONB DEFAULT '{}'::jsonb,
  
  -- HISTORIAL EMOCIONAL
  emotional_history JSONB DEFAULT '[]'::jsonb,
  
  -- METADATA
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" 
ON public.user_profile FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.user_profile FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.user_profile FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_user_profile_updated_at
BEFORE UPDATE ON public.user_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- MÓDULO FINANZAS
-- ═══════════════════════════════════════════════════════════

-- Tabla de cuentas/fuentes de dinero
CREATE TABLE public.finance_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL, -- 'Cuenta principal', 'Ahorro', 'Negocio'
  account_type TEXT NOT NULL DEFAULT 'bank', -- 'bank', 'cash', 'investment', 'credit'
  balance DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own accounts" 
ON public.finance_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own accounts" 
ON public.finance_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts" 
ON public.finance_accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts" 
ON public.finance_accounts FOR DELETE USING (auth.uid() = user_id);

-- Tabla de transacciones (ingresos y gastos)
CREATE TABLE public.finance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  
  transaction_type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
  category TEXT NOT NULL, -- 'salary', 'freelance', 'food', 'transport', 'subscriptions', etc.
  subcategory TEXT,
  
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  description TEXT,
  vendor TEXT, -- Proveedor/cliente
  
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT, -- 'monthly', 'weekly', 'yearly'
  
  -- Para facturas
  invoice_number TEXT,
  invoice_status TEXT, -- 'pending', 'paid', 'overdue'
  due_date DATE,
  
  tags JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" 
ON public.finance_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" 
ON public.finance_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
ON public.finance_transactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" 
ON public.finance_transactions FOR DELETE USING (auth.uid() = user_id);

-- Tabla de presupuestos
CREATE TABLE public.finance_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  category TEXT NOT NULL,
  budget_amount DECIMAL(12,2) NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly', -- 'weekly', 'monthly', 'yearly'
  
  alert_threshold INTEGER DEFAULT 80, -- Alertar al 80% del presupuesto
  
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budgets" 
ON public.finance_budgets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own budgets" 
ON public.finance_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" 
ON public.finance_budgets FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" 
ON public.finance_budgets FOR DELETE USING (auth.uid() = user_id);

-- Tabla de metas financieras
CREATE TABLE public.finance_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  name TEXT NOT NULL, -- 'Fondo de emergencia', 'Vacaciones', etc.
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  
  deadline DATE,
  priority TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused'
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals" 
ON public.finance_goals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
ON public.finance_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.finance_goals FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
ON public.finance_goals FOR DELETE USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_finance_accounts_updated_at
BEFORE UPDATE ON public.finance_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_transactions_updated_at
BEFORE UPDATE ON public.finance_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_budgets_updated_at
BEFORE UPDATE ON public.finance_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_goals_updated_at
BEFORE UPDATE ON public.finance_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();