-- Create jarvis_emails_cache table
CREATE TABLE public.jarvis_emails_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview TEXT,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jarvis_whatsapp_cache table
CREATE TABLE public.jarvis_whatsapp_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_name TEXT NOT NULL,
  last_message TEXT NOT NULL,
  last_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jarvis_emails_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_whatsapp_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for emails
CREATE POLICY "Users can view their own emails" 
ON public.jarvis_emails_cache 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own emails" 
ON public.jarvis_emails_cache 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails" 
ON public.jarvis_emails_cache 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails" 
ON public.jarvis_emails_cache 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for WhatsApp
CREATE POLICY "Users can view their own whatsapp chats" 
ON public.jarvis_whatsapp_cache 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whatsapp chats" 
ON public.jarvis_whatsapp_cache 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whatsapp chats" 
ON public.jarvis_whatsapp_cache 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whatsapp chats" 
ON public.jarvis_whatsapp_cache 
FOR DELETE 
USING (auth.uid() = user_id);