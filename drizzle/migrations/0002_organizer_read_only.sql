-- Producers (organizer role) become read-only: only admins and the master account may create, edit or delete events and lots.
DROP POLICY IF EXISTS "Organizers can create events" ON public.events;
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
DROP POLICY IF EXISTS "Organizers can delete own events" ON public.events;

DROP POLICY IF EXISTS "Organizers can manage batches" ON public.ticket_batches;
DROP POLICY IF EXISTS "Organizers can view own event batches" ON public.ticket_batches;
DROP POLICY IF EXISTS "Admins manage batches" ON public.ticket_batches;

CREATE POLICY "Organizers can view own event batches"
ON public.ticket_batches FOR SELECT TO authenticated
USING (public.is_event_organizer(event_id));

CREATE POLICY "Admins manage batches"
ON public.ticket_batches FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR (auth.jwt() ->> 'email') = 'lribeiro@easyticket.com')
WITH CHECK (public.has_role(auth.uid(), 'admin') OR (auth.jwt() ->> 'email') = 'lribeiro@easyticket.com');

CREATE OR REPLACE FUNCTION public.activate_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  SELECT event_id INTO v_event_id FROM public.ticket_batches WHERE id = p_batch_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Lote não encontrado');
  END IF;

  -- Authorization: only admins or the master account
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR (auth.jwt() ->> 'email') = 'lribeiro@easyticket.com'
  ) THEN
    RETURN jsonb_build_object('error', 'Não autorizado');
  END IF;

  UPDATE public.ticket_batches SET is_active = false WHERE event_id = v_event_id;
  UPDATE public.ticket_batches SET is_active = true WHERE id = p_batch_id;

  RETURN jsonb_build_object('success', true, 'batch_id', p_batch_id);
END;
$function$;