
-- 1. Add user_id column to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Backfill existing tickets: match holder_email to auth.users email
UPDATE public.tickets t
SET user_id = u.id
FROM auth.users u
WHERE t.holder_email = u.email AND t.user_id IS NULL;

-- 3. Drop old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own tickets or organizers view all" ON public.tickets;

-- 4. Create new PERMISSIVE SELECT policy using user_id
CREATE POLICY "Users can view own tickets"
ON public.tickets FOR SELECT
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'organizer'::app_role)
);

-- 5. Update Super Admin policy to PERMISSIVE (drop + recreate)
DROP POLICY IF EXISTS "Super Admin full access to tickets" ON public.tickets;
CREATE POLICY "Super Admin full access to tickets"
ON public.tickets FOR ALL
USING ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text)
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text);

-- 6. Recreate organizer update policy as permissive
DROP POLICY IF EXISTS "Organizers can update tickets for their events" ON public.tickets;
CREATE POLICY "Organizers can update tickets for their events"
ON public.tickets FOR UPDATE
USING (is_event_organizer(event_id));

-- 7. Also fix orders policies to be PERMISSIVE
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
CREATE POLICY "Buyers can view own orders"
ON public.orders FOR SELECT
USING (buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

DROP POLICY IF EXISTS "Organizers can view all orders" ON public.orders;
CREATE POLICY "Organizers can view all orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'organizer'::app_role));

DROP POLICY IF EXISTS "Super Admin full access to orders" ON public.orders;
CREATE POLICY "Super Admin full access to orders"
ON public.orders FOR ALL
USING ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text)
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text);
