
-- Fix tickets policies: drop restrictive ones, recreate as permissive without auth.users reference
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Super Admin full access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Organizers can update tickets for their events" ON public.tickets;

CREATE POLICY "Users can view own tickets"
ON public.tickets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'organizer'::app_role));

CREATE POLICY "Super Admin full access to tickets"
ON public.tickets FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'lribeiro@easyticket.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'lribeiro@easyticket.com');

CREATE POLICY "Organizers can update tickets for their events"
ON public.tickets FOR UPDATE TO authenticated
USING (is_event_organizer(event_id));

-- Fix orders policies: remove auth.users reference
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Organizers can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Super Admin full access to orders" ON public.orders;

-- Add user_id to orders if not exists for future use, but for now match by auth.uid() email via jwt
CREATE POLICY "Buyers can view own orders"
ON public.orders FOR SELECT TO authenticated
USING (buyer_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Organizers can view all orders"
ON public.orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'organizer'::app_role));

CREATE POLICY "Super Admin full access to orders"
ON public.orders FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'lribeiro@easyticket.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'lribeiro@easyticket.com');

-- Fix events: ensure public read access
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
DROP POLICY IF EXISTS "Organizers can view all events" ON public.events;

CREATE POLICY "Anyone can view published events"
ON public.events FOR SELECT TO anon, authenticated
USING (published = true);

CREATE POLICY "Organizers can view all events"
ON public.events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'organizer'::app_role));
