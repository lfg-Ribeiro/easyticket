ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meta_pixel_id text;

CREATE TABLE public.event_meta_secrets (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  capi_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_meta_secrets TO authenticated;
GRANT ALL ON public.event_meta_secrets TO service_role;
ALTER TABLE public.event_meta_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage meta secrets" ON public.event_meta_secrets FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS meta_fbp text,
  ADD COLUMN IF NOT EXISTS meta_fbc text,
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS client_user_agent text,
  ADD COLUMN IF NOT EXISTS meta_purchase_sent_at timestamptz;