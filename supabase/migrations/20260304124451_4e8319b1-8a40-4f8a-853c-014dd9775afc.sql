
-- Add status and sort_order to ticket_batches
ALTER TABLE public.ticket_batches 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Set sort_order for existing batches based on price (cheapest first)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY price ASC, created_at ASC) - 1 AS rn
  FROM public.ticket_batches
)
UPDATE public.ticket_batches tb
SET sort_order = r.rn
FROM ranked r
WHERE tb.id = r.id;

-- Mark batches with 0 available as sold_out, keep only the first available as active
WITH first_active AS (
  SELECT DISTINCT ON (event_id) id
  FROM public.ticket_batches
  WHERE available_quantity > 0
  ORDER BY event_id, sort_order ASC
)
UPDATE public.ticket_batches tb
SET status = CASE
  WHEN tb.available_quantity <= 0 THEN 'sold_out'
  WHEN tb.id IN (SELECT id FROM first_active) THEN 'active'
  ELSE 'inactive'
END;

-- Create atomic function to consume tickets from a batch and handle batch switching
CREATE OR REPLACE FUNCTION public.consume_batch_tickets(
  p_batch_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch RECORD;
  v_event_id uuid;
  v_new_available integer;
BEGIN
  -- Lock the batch row for update
  SELECT * INTO v_batch
  FROM public.ticket_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Lote não encontrado');
  END IF;

  IF v_batch.status != 'active' THEN
    RETURN jsonb_build_object('error', 'Este lote não está mais disponível');
  END IF;

  IF v_batch.available_quantity < p_quantity THEN
    RETURN jsonb_build_object('error', 
      'A quantidade solicitada excede os ingressos restantes neste lote. Disponível: ' || v_batch.available_quantity);
  END IF;

  v_event_id := v_batch.event_id;
  v_new_available := v_batch.available_quantity - p_quantity;

  -- Decrement available quantity
  UPDATE public.ticket_batches
  SET available_quantity = v_new_available
  WHERE id = p_batch_id;

  -- If batch is now sold out, switch to next batch
  IF v_new_available = 0 THEN
    UPDATE public.ticket_batches SET status = 'sold_out' WHERE id = p_batch_id;

    -- Activate the next batch in order
    UPDATE public.ticket_batches
    SET status = 'active'
    WHERE id = (
      SELECT id FROM public.ticket_batches
      WHERE event_id = v_event_id AND status = 'inactive' AND available_quantity > 0
      ORDER BY sort_order ASC
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining', v_new_available);
END;
$$;
