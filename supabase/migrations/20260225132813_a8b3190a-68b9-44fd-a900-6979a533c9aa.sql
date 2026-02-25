
-- 1. Make cpf UNIQUE on profiles (drop if exists to be safe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cpf_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_cpf_unique UNIQUE (cpf);
  END IF;
END $$;

-- 2. Add holder_cpf to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS holder_cpf text;

-- 3. Create transfer_ticket function
CREATE OR REPLACE FUNCTION public.transfer_ticket(p_ticket_id uuid, p_new_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_new_owner RECORD;
BEGIN
  -- Verify the ticket exists, belongs to caller, and is valid
  SELECT * INTO v_ticket FROM public.tickets
  WHERE id = p_ticket_id AND user_id = auth.uid() AND check_in_status = 'valid';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ingresso não encontrado ou não pertence a você.');
  END IF;

  -- Find the new owner by CPF
  SELECT auth_id, full_name, cpf INTO v_new_owner FROM public.profiles
  WHERE cpf = p_new_cpf;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CPF não cadastrado. O destinatário precisa criar uma conta primeiro.');
  END IF;

  -- Prevent self-transfer
  IF v_new_owner.auth_id = auth.uid() THEN
    RETURN jsonb_build_object('error', 'Você não pode transferir para si mesmo.');
  END IF;

  -- Transfer
  UPDATE public.tickets
  SET user_id = v_new_owner.auth_id,
      holder_cpf = p_new_cpf,
      holder_name = COALESCE(v_new_owner.full_name, holder_name)
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'new_holder', v_new_owner.full_name);
END;
$$;
