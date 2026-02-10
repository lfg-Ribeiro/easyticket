
-- Allow buyers to view their own tickets by email
CREATE POLICY "Buyers can view own tickets"
ON public.tickets
FOR SELECT
USING (holder_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow buyers to view their own orders by email
CREATE POLICY "Buyers can view own orders"
ON public.orders
FOR SELECT
USING (buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid()));
