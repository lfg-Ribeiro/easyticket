ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_time time without time zone,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
CREATE POLICY "Anyone can view published events"
ON public.events FOR SELECT
TO anon, authenticated
USING (published = true AND deleted_at IS NULL);