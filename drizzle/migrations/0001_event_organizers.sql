CREATE TABLE public.event_organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT ON public.event_organizers TO authenticated;
GRANT ALL ON public.event_organizers TO service_role;
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own event links" ON public.event_organizers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_event_organizer(_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_organizers WHERE event_id = _event_id AND user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
$$;

DROP POLICY IF EXISTS "Organizers can view all events" ON public.events;
CREATE POLICY "Organizers view own or linked events" ON public.events FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR public.is_event_organizer(id));
CREATE POLICY "Admins full access to events" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
CREATE POLICY "Organizers can update own events" ON public.events FOR UPDATE TO authenticated
  USING (public.is_event_organizer(id));

DROP POLICY IF EXISTS "Organizers can view all orders" ON public.orders;
CREATE POLICY "Organizers view orders of their events" ON public.orders FOR SELECT TO authenticated
  USING (public.is_event_organizer(event_id));

DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
CREATE POLICY "Users can view own tickets" ON public.tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_organizer(event_id));