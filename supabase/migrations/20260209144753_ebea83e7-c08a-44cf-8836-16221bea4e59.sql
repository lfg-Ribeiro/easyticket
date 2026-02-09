
-- Limpar dados fictícios (ordem de dependência)
DELETE FROM tickets;
DELETE FROM orders;
DELETE FROM ticket_batches;
DELETE FROM events;

-- Atualizar trigger para admin master
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  -- Admin master: auto-assign organizer role
  IF NEW.email = 'lribeiro@easyticket.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'organizer') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
