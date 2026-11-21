-- =====================================================================
-- Roadmap 3.3 — Rastreamento de indicações (Atléticas / Comissionados)
--
--   * orders.referred_by       -> código do link (?ref=...) que originou o pedido
--   * event_affiliates         -> atléticas/promoters cadastrados por evento (+ % de comissão)
--   * attach_order_referral()  -> grava referred_by logo após o create-checkout
--                                 (sem alterar a Edge Function create-checkout)
--   * get_affiliate_name()     -> nome público de um comissionado (sem expor a comissão)
--
-- Integridade:
--   * Relatórios de comissionados contam SOMENTE pedidos confirmados/pagos (orders).
--     Cortesias não têm pedido (ver 20261118_courtesy_tickets.sql), então nunca entram.
--   * referred_by é "first-touch": depois de gravado no pedido, não muda mais.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. orders.referred_by
-- ---------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referred_by text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_referred_by_format_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_referred_by_format_check
  CHECK (referred_by IS NULL OR referred_by ~ '^[a-z0-9_-]{1,64}$');

CREATE INDEX IF NOT EXISTS idx_orders_event_referred_by
  ON public.orders (event_id, referred_by);

-- ---------------------------------------------------------------------
-- 2. event_affiliates
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  ref_code text NOT NULL CHECK (ref_code ~ '^[a-z0-9_-]{1,64}$'),
  commission_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (commission_percent >= 0 AND commission_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, ref_code)
);

CREATE INDEX IF NOT EXISTS idx_event_affiliates_event ON public.event_affiliates (event_id);

ALTER TABLE public.event_affiliates ENABLE ROW LEVEL SECURITY;

-- Quem gerencia os comissionados de um evento: criador, produtor vinculado, admin ou conta master.
-- (to_regclass: event_organizers foi criada fora das migrations do repositório;
--  o papel é comparado como texto para não depender do enum app_role já ter 'admin')
CREATE OR REPLACE FUNCTION public.can_manage_event_affiliates(_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF lower(coalesce(auth.jwt() ->> 'email', '')) = 'lribeiro@easyticket.com' THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin') THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.organizer_id = auth.uid()) THEN
    RETURN true;
  END IF;

  IF to_regclass('public.event_organizers') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.event_organizers eo
      WHERE eo.event_id = _event_id AND eo.user_id = auth.uid()
    );
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Producers can view event affiliates" ON public.event_affiliates;
DROP POLICY IF EXISTS "Producers can insert event affiliates" ON public.event_affiliates;
DROP POLICY IF EXISTS "Producers can update event affiliates" ON public.event_affiliates;
DROP POLICY IF EXISTS "Producers can delete event affiliates" ON public.event_affiliates;

CREATE POLICY "Producers can view event affiliates"
ON public.event_affiliates FOR SELECT TO authenticated
USING (public.can_manage_event_affiliates(event_id));

CREATE POLICY "Producers can insert event affiliates"
ON public.event_affiliates FOR INSERT TO authenticated
WITH CHECK (public.can_manage_event_affiliates(event_id));

CREATE POLICY "Producers can update event affiliates"
ON public.event_affiliates FOR UPDATE TO authenticated
USING (public.can_manage_event_affiliates(event_id))
WITH CHECK (public.can_manage_event_affiliates(event_id));

CREATE POLICY "Producers can delete event affiliates"
ON public.event_affiliates FOR DELETE TO authenticated
USING (public.can_manage_event_affiliates(event_id));

-- ---------------------------------------------------------------------
-- 3. attach_order_referral — chamada pelo front logo após o create-checkout
--
-- orders não tem user_id e o comprador pode ser convidado (sessão anônima), então a posse do
-- pedido é comprovada de duas formas:
--   (a) usuário logado cujo e-mail é o buyer_email do pedido; ou
--   (b) pedido recém-criado (< 30 min) ainda pendente — quem acabou de criá-lo é o único que
--       conhece o UUID, que só é devolvido pelo create-checkout.
-- Em ambos os casos: pedido pendente e referred_by ainda nulo (first-touch imutável).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_order_referral(p_order_id uuid, p_referred_by text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_rows int;
BEGIN
  -- lower(trim()), espaços -> '_', somente [a-z0-9_-], no máximo 64 caracteres
  v_ref := lower(trim(coalesce(p_referred_by, '')));
  v_ref := regexp_replace(v_ref, '\s+', '_', 'g');
  v_ref := regexp_replace(v_ref, '[^a-z0-9_-]', '', 'g');
  v_ref := left(v_ref, 64);

  IF p_order_id IS NULL OR v_ref = '' THEN
    RETURN false;
  END IF;

  UPDATE public.orders o
  SET referred_by = v_ref
  WHERE o.id = p_order_id
    AND o.referred_by IS NULL
    AND o.payment_status = 'pending'
    AND (
      (v_email <> '' AND lower(o.buyer_email) = v_email)
      OR o.created_at > now() - interval '30 minutes'
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. get_affiliate_name — nome público para o selo "Indicação" do checkout.
--    Não expõe a comissão (event_affiliates continua restrita aos produtores).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_affiliate_name(p_event_id uuid, p_ref_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.name
  FROM public.event_affiliates a
  WHERE a.event_id = p_event_id
    AND a.ref_code = lower(trim(coalesce(p_ref_code, '')))
  LIMIT 1
$$;

-- ---------------------------------------------------------------------
-- 5. Permissões de execução (o Supabase concede EXECUTE a anon/authenticated por padrão)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.can_manage_event_affiliates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event_affiliates(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.attach_order_referral(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_order_referral(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_affiliate_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_affiliate_name(uuid, text) TO anon, authenticated;

COMMENT ON COLUMN public.orders.referred_by IS 'Código do link de indicação (?ref=) que originou o pedido. First-touch, imutável depois de gravado.';
COMMENT ON TABLE public.event_affiliates IS 'Atléticas/promoters cadastrados por evento, com % de comissão. Visível somente aos produtores do evento.';

NOTIFY pgrst, 'reload schema';
