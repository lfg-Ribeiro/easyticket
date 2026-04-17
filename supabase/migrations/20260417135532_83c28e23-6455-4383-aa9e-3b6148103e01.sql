-- Limpeza de dados para transição para Produção
-- Mantém: usuários (auth.users), perfis (profiles), user_roles
-- Remove: eventos, lotes, ingressos e pedidos de teste

-- Primeiro, desativar temporariamente triggers que podem interferir
-- (se houver triggers em events/orders que criem registros em outras tabelas)

-- Limpar tabela de tickets (depende de orders e events)
DELETE FROM public.tickets;

-- Limpar tabela de orders (depende de events)
DELETE FROM public.orders;

-- Limpar tabela de lotes de ingressos (depende de events)
DELETE FROM public.ticket_batches;

-- Finalmente, limpar tabela de eventos
DELETE FROM public.events;

-- Resetar sequências se houver (opcional, mas garante IDs começando do início)
-- Nota: gen_random_uuid() não usa sequências, então não é necessário para UUIDs