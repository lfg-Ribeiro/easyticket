-- Add is_active manual control column to ticket_batches
ALTER TABLE public.ticket_batches
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- Seed: mark currently 'active' status batches as is_active for continuity
UPDATE public.ticket_batches SET is_active = true WHERE status = 'active';

-- Ensure only one active batch per event (keep the lowest sort_order if multiple)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY sort_order ASC, created_at ASC) AS rn
  FROM public.ticket_batches
  WHERE is_active = true
)
UPDATE public.ticket_batches b
SET is_active = false
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

-- Function: manually activate one batch and deactivate all others in the same event
CREATE OR REPLACE FUNCTION public.activate_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  SELECT event_id INTO v_event_id FROM public.ticket_batches WHERE id = p_batch_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Lote não encontrado');
  END IF;

  -- Authorization: only the event organizer or master admin
  IF NOT (
    public.is_event_organizer(v_event_id)
    OR (auth.jwt() ->> 'email') = 'lribeiro@easyticket.com'
  ) THEN
    RETURN jsonb_build_object('error', 'Não autorizado');
  END IF;

  -- Deactivate all batches of this event
  UPDATE public.ticket_batches
  SET is_active = false
  WHERE event_id = v_event_id;

  -- Activate the selected batch
  UPDATE public.ticket_batches
  SET is_active = true
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('success', true, 'batch_id', p_batch_id);
END;
$$;