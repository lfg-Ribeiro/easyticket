
-- Allow organizers to view ALL events (super admin)
DROP POLICY IF EXISTS "Organizers can view own events" ON public.events;
CREATE POLICY "Organizers can view all events"
  ON public.events FOR SELECT
  USING (
    published = true
    OR has_role(auth.uid(), 'organizer'::app_role)
  );

-- Allow organizers to view ALL orders (super admin dashboard)
DROP POLICY IF EXISTS "Organizers can view orders for their events" ON public.orders;
CREATE POLICY "Organizers can view all orders"
  ON public.orders FOR SELECT
  USING (
    buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    OR has_role(auth.uid(), 'organizer'::app_role)
  );

-- Allow organizers to view ALL tickets (super admin dashboard)
DROP POLICY IF EXISTS "Organizers can view tickets for their events" ON public.tickets;
CREATE POLICY "Organizers can view all tickets"
  ON public.tickets FOR SELECT
  USING (
    holder_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    OR has_role(auth.uid(), 'organizer'::app_role)
  );
