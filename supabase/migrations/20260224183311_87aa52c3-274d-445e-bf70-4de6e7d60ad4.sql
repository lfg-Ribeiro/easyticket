
-- =====================================================
-- Fix: Change RESTRICTIVE policies to PERMISSIVE on tickets and orders
-- Root cause: all policies were RESTRICTIVE, PostgreSQL requires at least 
-- one PERMISSIVE policy for any rows to be returned.
-- =====================================================

-- TICKETS: Drop all existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view own tickets or organizers view all" ON public.tickets;
DROP POLICY IF EXISTS "Super Admin full access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Organizers can update tickets for their events" ON public.tickets;

CREATE POLICY "Users can view own tickets or organizers view all"
  ON public.tickets FOR SELECT
  USING (
    holder_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    OR has_role(auth.uid(), 'organizer'::app_role)
  );

CREATE POLICY "Super Admin full access to tickets"
  ON public.tickets FOR ALL
  USING ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text);

CREATE POLICY "Organizers can update tickets for their events"
  ON public.tickets FOR UPDATE
  USING (is_event_organizer(event_id));

-- ORDERS: Drop all existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Organizers can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Super Admin full access to orders" ON public.orders;

CREATE POLICY "Buyers can view own orders"
  ON public.orders FOR SELECT
  USING (
    buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  );

CREATE POLICY "Organizers can view all orders"
  ON public.orders FOR SELECT
  USING (has_role(auth.uid(), 'organizer'::app_role));

CREATE POLICY "Super Admin full access to orders"
  ON public.orders FOR ALL
  USING ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'lribeiro@easyticket.com'::text);

-- =====================================================
-- Sales Performance RPC for dynamic chart
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_sales_by_day(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  sale_date date,
  tickets_sold bigint,
  revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    DATE(o.created_at) as sale_date,
    SUM(o.quantity)::bigint as tickets_sold,
    SUM(o.total_amount) as revenue
  FROM public.orders o
  WHERE o.created_at >= start_date
    AND o.created_at < end_date
    AND o.payment_status IN ('confirmed', 'paid')
  GROUP BY DATE(o.created_at)
  ORDER BY sale_date;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_by_hour(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  sale_hour int,
  tickets_sold bigint,
  revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    EXTRACT(HOUR FROM o.created_at)::int as sale_hour,
    SUM(o.quantity)::bigint as tickets_sold,
    SUM(o.total_amount) as revenue
  FROM public.orders o
  WHERE o.created_at >= start_date
    AND o.created_at < end_date
    AND o.payment_status IN ('confirmed', 'paid')
  GROUP BY EXTRACT(HOUR FROM o.created_at)
  ORDER BY sale_hour;
$$;
