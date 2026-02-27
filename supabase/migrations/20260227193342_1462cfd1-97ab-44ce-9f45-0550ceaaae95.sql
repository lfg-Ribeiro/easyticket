
CREATE OR REPLACE FUNCTION public.transfer_ticket(p_ticket_id uuid, p_new_cpf text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket RECORD;
  v_new_owner RECORD;
  v_clean_cpf text;
BEGIN
  -- Clean input CPF
  v_clean_cpf := regexp_replace(p_new_cpf, '[^0-9]', '', 'g');

  SELECT * INTO v_ticket FROM public.tickets
  WHERE id = p_ticket_id AND user_id = auth.uid() AND check_in_status = 'valid';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ingresso não encontrado ou não pertence a você.');
  END IF;

  -- Find new owner comparing cleaned CPFs
  SELECT auth_id, full_name, cpf INTO v_new_owner FROM public.profiles
  WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = v_clean_cpf;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CPF não cadastrado. O destinatário precisa criar uma conta primeiro.');
  END IF;

  IF v_new_owner.auth_id = auth.uid() THEN
    RETURN jsonb_build_object('error', 'Você não pode transferir para si mesmo.');
  END IF;

  UPDATE public.tickets
  SET user_id = v_new_owner.auth_id,
      holder_cpf = v_clean_cpf,
      holder_name = COALESCE(v_new_owner.full_name, holder_name)
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'new_holder', v_new_owner.full_name);
END;
$function$;
