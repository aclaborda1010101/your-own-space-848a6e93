ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS show_day_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_quick_actions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_notifications_panel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_contacts_card boolean NOT NULL DEFAULT true;