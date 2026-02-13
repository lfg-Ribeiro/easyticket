
-- Super Admin policies for lribeiro@easyticket.com
CREATE POLICY "Super Admin full access to orders"
ON public.orders FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com')
WITH CHECK (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com');

CREATE POLICY "Super Admin full access to tickets"
ON public.tickets FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com')
WITH CHECK (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com');

CREATE POLICY "Super Admin full access to events"
ON public.events FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com')
WITH CHECK (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com');

CREATE POLICY "Super Admin full access to profiles"
ON public.profiles FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com')
WITH CHECK (auth.jwt() ->> 'email' = 'lribeiro@easyticket.com');
