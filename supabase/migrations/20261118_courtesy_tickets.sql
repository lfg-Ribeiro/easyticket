-- =====================================================================
-- Roadmap 3.1 + 3.2 — Sistema de cortesias
--
--   * courtesy_type = 'admin'     -> cortesia "fantasma" dos donos da plataforma
--                                    (automática por trigger + emissão manual via RPC).
--                                    Invisível para produtores em qualquer tela/consulta.
--   * courtesy_type = 'organizer' -> cortesia emitida pelo produtor para o próprio evento,
--                                    visível apenas na aba "Cortesias" do produtor.
--
-- Regras de ouro:
--   * Cortesia NUNCA cria pedido (orders) nem consome estoque de ticket_batches.
--     Por isso ela não entra em "Ingressos Vendidos", receita nem taxa de 5%
--     (todas essas métricas são calculadas a partir de orders confirmados).
--   * A constraint tickets_courtesy_consistency_check garante isso no banco:
--     cortesia => sem order_id; ingresso pago => com order_id.
--   * Emissão manual só por RPC SECURITY DEFINER (nada de INSERT direto pelo cliente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas em public.tickets
-- ---------------------------------------------------------------------
ALTER TABLE public.tickets ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS is_complimentary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS courtesy_type text,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_cpf text;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_courtesy_type_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_courtesy_type_check
  CHECK (courtesy_type IS NULL OR courtesy_type IN ('admin', 'organizer'));

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_courtesy_consistency_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_courtesy_consistency_check
  CHECK (
    (is_complimentary AND courtesy_type IS NOT NULL AND order_id IS NULL)
    OR (NOT is_complimentary AND courtesy_type IS NULL AND order_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_tickets_courtesy_event
  ON public.tickets (event_id, courtesy_type) WHERE is_complimentary;
CREATE INDEX IF NOT EXISTS idx_tickets_courtesy_guest_email
  ON public.tickets (lower(guest_email)) WHERE is_complimentary;

-- ---------------------------------------------------------------------
-- 2. Funções auxiliares
-- ---------------------------------------------------------------------

-- Donos da plataforma (única fonte de verdade no banco; espelhado em src/lib/permissions.ts)
CREATE OR REPLACE FUNCTION public.platform_owner_emails()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['lribeiro@easyticket.com', 'zluan720@gmail.com']::text[]
$$;

-- true quando o JWT da sessão pertence a um dono da plataforma COM e-mail confirmado
-- (evita que alguém cadastre o e-mail de um dono sem confirmação e ganhe poderes de dono).
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (public.platform_owner_emails())
     AND EXISTS (
       SELECT 1 FROM auth.users u
       WHERE u.id = auth.uid()
         AND u.email_confirmed_at IS NOT NULL
         AND lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     )
$$;

-- Compara o papel como texto: não depende do enum app_role já conter 'admin'
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'admin'
  );
END;
$$;

-- Produtor do evento: criador (events.organizer_id) ou vinculado em event_organizers
-- (to_regclass: a tabela event_organizers foi criada fora das migrations do repositório)
CREATE OR REPLACE FUNCTION public.is_event_producer(_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Quem pode emitir/revogar cortesia de produtor para um evento
CREATE OR REPLACE FUNCTION public.can_issue_courtesy(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_owner()
      OR public.is_platform_admin()
      OR public.is_event_producer(_event_id)
$$;

-- CPF com dígitos verificadores (mesma regra de src/lib/validation.ts)
CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  s int;
  r int;
  i int;
BEGIN
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;

  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(d, i, 1)::int * (11 - i); END LOOP;
  r := (s * 10) % 11;
  IF r = 10 THEN r := 0; END IF;
  IF r <> substr(d, 10, 1)::int THEN RETURN false; END IF;

  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(d, i, 1)::int * (12 - i); END LOOP;
  r := (s * 10) % 11;
  IF r = 10 THEN r := 0; END IF;
  RETURN r = substr(d, 11, 1)::int;
END;
$$;

-- QR no mesmo formato dos ingressos vendidos (TICKET-XXXXXXXX-N-XXXXXXXX), sem prefixo que
-- revele que é cortesia. validate-ticket apenas busca por qr_code.
CREATE OR REPLACE FUNCTION public.generate_ticket_qr(p_index int DEFAULT 1)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT upper(
    'TICKET-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
    || '-' || greatest(p_index, 1)::text
    || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8)
  )
$$;

-- Procura conta existente: primeiro por CPF (somente dígitos), depois por e-mail
CREATE OR REPLACE FUNCTION public.resolve_courtesy_holder(p_email text, p_cpf text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF length(v_cpf) = 11 THEN
    SELECT auth_id INTO v_user FROM public.profiles
    WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf
    ORDER BY created_at LIMIT 1;
  END IF;
  IF v_user IS NULL AND v_email <> '' THEN
    SELECT auth_id INTO v_user FROM public.profiles
    WHERE lower(email) = v_email
    ORDER BY created_at LIMIT 1;
  END IF;
  IF v_user IS NULL AND v_email <> '' THEN
    SELECT id INTO v_user FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  END IF;
  RETURN v_user;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Emissão (núcleo compartilhado pelas duas RPCs) — NÃO exposta ao cliente
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_courtesy_tickets(
  p_event_id uuid,
  p_type text,
  p_guest_name text,
  p_guest_email text,
  p_guest_cpf text,
  p_quantity int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(coalesce(p_guest_name, ''));
  v_email text := lower(trim(coalesce(p_guest_email, '')));
  v_cpf text := regexp_replace(coalesce(p_guest_cpf, ''), '\D', '', 'g');
  v_user uuid;
  v_ids uuid[] := '{}';
  v_codes text[] := '{}';
  v_id uuid;
  v_code text;
  i int;
BEGIN
  IF p_type NOT IN ('admin', 'organizer') THEN
    RAISE EXCEPTION 'Tipo de cortesia inválido' USING ERRCODE = '22023';
  END IF;
  IF p_event_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Evento não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Nome do convidado inválido' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'E-mail do convidado inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_valid_cpf(v_cpf) THEN
    RAISE EXCEPTION 'CPF do convidado inválido' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 20 THEN
    RAISE EXCEPTION 'Quantidade deve ser entre 1 e 20' USING ERRCODE = '22023';
  END IF;

  v_user := public.resolve_courtesy_holder(v_email, v_cpf);

  FOR i IN 1..p_quantity LOOP
    INSERT INTO public.tickets (
      order_id, event_id, batch_id, qr_code,
      holder_name, holder_email, holder_cpf, check_in_status, user_id,
      is_complimentary, courtesy_type, guest_name, guest_email, guest_cpf
    ) VALUES (
      NULL, p_event_id, NULL, public.generate_ticket_qr(i),
      v_name, v_email, v_cpf, 'valid', v_user,
      true, p_type, v_name, v_email, v_cpf
    )
    RETURNING id, qr_code INTO v_id, v_code;
    v_ids := v_ids || v_id;
    v_codes := v_codes || v_code;
  END LOOP;

  RETURN jsonb_build_object(
    'issued', p_quantity,
    'user_linked', v_user IS NOT NULL,
    'ticket_ids', to_jsonb(v_ids),
    'qr_codes', to_jsonb(v_codes)
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC dos donos: Cortesia Master (courtesy_type = 'admin')
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_admin_courtesy(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_cpf text,
  p_quantity int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- lower(auth.jwt() ->> 'email') IN (donos) + e-mail confirmado (ver is_platform_owner)
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN public.insert_courtesy_tickets(
    p_event_id, 'admin', p_guest_name, p_guest_email, p_guest_cpf, p_quantity
  );
END;
$$;

-- Lista TODOS os eventos para o seletor da Cortesia Master (o RLS de events não mostra
-- eventos não publicados para quem não tem papel de organizer/admin)
CREATE OR REPLACE FUNCTION public.list_admin_courtesy_events()
RETURNS TABLE (id uuid, title text, event_date date, published boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.title, e.event_date, e.published
    FROM public.events e
    WHERE e.deleted_at IS NULL
    ORDER BY e.event_date DESC, e.title;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC do produtor: Emitir Cortesia (courtesy_type = 'organizer')
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_organizer_courtesy(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_cpf text,
  p_quantity int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_issue_courtesy(p_event_id) THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN public.insert_courtesy_tickets(
    p_event_id, 'organizer', p_guest_name, p_guest_email, p_guest_cpf, p_quantity
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Trigger 3.1: 1 cortesia 'admin' para cada dono em TODO evento novo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_admin_courtesy_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_profile record;
  v_user uuid;
  v_name text;
  v_cpf text;
  v_idx int := 0;
BEGIN
  FOREACH v_email IN ARRAY public.platform_owner_emails() LOOP
    v_idx := v_idx + 1;
    -- Uma falha numa cortesia nunca pode impedir a criação do evento
    BEGIN
      v_user := NULL; v_name := NULL; v_cpf := NULL;

      SELECT auth_id, full_name, cpf INTO v_profile
      FROM public.profiles WHERE lower(email) = v_email ORDER BY created_at LIMIT 1;

      IF FOUND THEN
        v_user := v_profile.auth_id;
        v_name := NULLIF(trim(coalesce(v_profile.full_name, '')), '');
        v_cpf := NULLIF(regexp_replace(coalesce(v_profile.cpf, ''), '\D', '', 'g'), '');
      ELSE
        SELECT id INTO v_user FROM auth.users WHERE lower(email) = v_email LIMIT 1;
      END IF;

      v_name := coalesce(v_name, split_part(v_email, '@', 1));

      INSERT INTO public.tickets (
        order_id, event_id, batch_id, qr_code,
        holder_name, holder_email, holder_cpf, check_in_status, user_id,
        is_complimentary, courtesy_type, guest_name, guest_email, guest_cpf
      ) VALUES (
        NULL, NEW.id, NULL, public.generate_ticket_qr(v_idx),
        v_name, v_email, v_cpf, 'valid', v_user,
        true, 'admin', v_name, v_email, v_cpf
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'grant_admin_courtesy_tickets: falha para % no evento %: %', v_email, NEW.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_admin_courtesy_tickets ON public.events;
CREATE TRIGGER trg_grant_admin_courtesy_tickets
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_courtesy_tickets();

-- ---------------------------------------------------------------------
-- 7. Vínculo automático quando o convidado se cadastra depois
--    (somente por e-mail: o CPF digitado no cadastro não é verificado, então
--     não pode ser usado para "reivindicar" cortesias de terceiros)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_courtesy_tickets_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets
  SET user_id = NEW.auth_id
  WHERE user_id IS NULL
    AND is_complimentary
    AND guest_email IS NOT NULL
    AND lower(guest_email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_courtesy_tickets_to_profile ON public.profiles;
CREATE TRIGGER trg_link_courtesy_tickets_to_profile
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_courtesy_tickets_to_profile();

-- ---------------------------------------------------------------------
-- 8. RLS em public.tickets
--    (mantém "Super Admin full access to tickets", que cobre o e-mail master)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Producers can view tickets of their events" ON public.tickets;
DROP POLICY IF EXISTS "Organizers can update tickets for their events" ON public.tickets;
DROP POLICY IF EXISTS "Producers can revoke unused organizer courtesies" ON public.tickets;

-- Dono do ingresso (comprador, transferido ou convidado de cortesia)
CREATE POLICY "Users can view own tickets"
ON public.tickets FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    is_complimentary
    AND guest_email IS NOT NULL
    AND lower(guest_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- Produtores veem os ingressos dos SEUS eventos — e nunca as cortesias 'admin'.
-- (Antes: qualquer usuário com papel organizer lia os ingressos de todos os eventos.)
CREATE POLICY "Producers can view tickets of their events"
ON public.tickets FOR SELECT TO authenticated
USING (
  courtesy_type IS DISTINCT FROM 'admin'
  AND (
    (has_role(auth.uid(), 'organizer'::app_role) AND public.is_event_producer(event_id))
    OR public.is_platform_admin()
  )
);

CREATE POLICY "Organizers can update tickets for their events"
ON public.tickets FOR UPDATE TO authenticated
USING (public.is_event_organizer(event_id) AND courtesy_type IS DISTINCT FROM 'admin')
WITH CHECK (courtesy_type IS DISTINCT FROM 'admin');

-- Revogar = excluir cortesia de produtor ainda não utilizada (o scanner passa a recusar o QR)
CREATE POLICY "Producers can revoke unused organizer courtesies"
ON public.tickets FOR DELETE TO authenticated
USING (
  is_complimentary
  AND courtesy_type = 'organizer'
  AND check_in_status = 'valid'
  AND public.can_issue_courtesy(event_id)
);

-- ---------------------------------------------------------------------
-- 9. Permissões de execução
--    (o Supabase concede EXECUTE a anon/authenticated por padrão: revoga explicitamente)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.insert_courtesy_tickets(uuid, text, text, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_courtesy_holder(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_ticket_qr(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_courtesy_tickets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_courtesy_tickets_to_profile() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.issue_admin_courtesy(uuid, text, text, text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_organizer_courtesy(uuid, text, text, text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_admin_courtesy_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_admin_courtesy(uuid, text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_organizer_courtesy(uuid, text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_courtesy_events() TO authenticated;

COMMENT ON COLUMN public.tickets.is_complimentary IS 'Cortesia: nunca entra em vendas, receita, taxa de 5% nem estoque de lotes.';
COMMENT ON COLUMN public.tickets.courtesy_type IS 'admin = cortesia fantasma dos donos (invisível ao produtor); organizer = emitida pelo produtor.';

NOTIFY pgrst, 'reload schema';
