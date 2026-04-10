CREATE POLICY "Ticket holders can view related orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.order_id = orders.id
      AND tickets.user_id = auth.uid()
  )
);