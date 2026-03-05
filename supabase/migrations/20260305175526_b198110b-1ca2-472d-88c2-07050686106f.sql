
CREATE OR REPLACE FUNCTION public.cleanup_expired_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_order RECORD;
  v_batch RECORD;
  v_count integer := 0;
BEGIN
  FOR expired_order IN
    SELECT o.id, t.batch_id, o.quantity
    FROM public.orders o
    LEFT JOIN public.tickets t ON t.order_id = o.id
    WHERE o.payment_status = 'pending'
      AND o.created_at < NOW() - INTERVAL '15 minutes'
    FOR UPDATE OF o
  LOOP
    -- Mark order as expired
    UPDATE public.orders SET payment_status = 'expired' WHERE id = expired_order.id;

    -- Delete unpaid tickets
    DELETE FROM public.tickets WHERE order_id = expired_order.id;

    -- Return stock to batch if batch_id exists
    IF expired_order.batch_id IS NOT NULL THEN
      SELECT * INTO v_batch FROM public.ticket_batches WHERE id = expired_order.batch_id FOR UPDATE;
      IF FOUND THEN
        UPDATE public.ticket_batches
        SET available_quantity = available_quantity + expired_order.quantity
        WHERE id = expired_order.batch_id;

        -- If batch was sold_out and now has stock, reactivate it if no other batch is active
        IF v_batch.status = 'sold_out' THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.ticket_batches
            WHERE event_id = v_batch.event_id AND status = 'active'
          ) THEN
            UPDATE public.ticket_batches SET status = 'active' WHERE id = expired_order.batch_id;
          END IF;
        END IF;
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('expired_count', v_count);
END;
$$;
