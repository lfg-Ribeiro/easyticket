

# Plano: Limpeza, Admin Master, Landing Page B2B e E-mail Simulado

## 1. Limpeza do Banco de Dados e Admin Master

**Migracao SQL** que fara:
- `DELETE` de todos os registros existentes nas tabelas `tickets`, `orders`, `ticket_batches` e `events` (nessa ordem por dependencias)
- Criacao de uma trigger que detecta o e-mail `lribeiro@easyticket.com` no signup e automaticamente atribui a role `organizer` alem da role `user` padrao
- Adicao de auto-confirm para esse e-mail especifico via a propria trigger (o e-mail sera confirmado automaticamente pelo trigger `handle_new_user` atualizado)

**Nota:** A auto-confirmacao de e-mail requer configurar o auth para confirmar automaticamente, ou usar a service_role key na trigger para confirmar o usuario. A abordagem mais segura e atualizar a trigger `handle_new_user` para, quando o e-mail for `lribeiro@easyticket.com`, inserir tambem a role `organizer`.

## 2. Landing Page B2B (/saiba-mais)

Nova pagina `src/pages/SaibaMais.tsx` com:
- Hero section com headline agressiva ("Venda ingressos com a menor taxa do mercado")
- Tabela comparativa de precos:
  - EasyTicket: 5% (destaque verde, badge "Melhor Opcao")
  - Concorrencia: 10% + taxas fixas (cinza, "Alto Custo")
- Secao de beneficios (scanner QR, dashboard, pagamento instantaneo)
- Botao CTA "Quero meu evento na EasyTicket" linkando para `https://wa.me/5545920025315`
- Rota adicionada em `App.tsx`

## 3. E-mail Simulado no Checkout

Atualizacao da edge function `create-checkout`:
- Apos criar order e tickets, tentar enviar e-mail via Resend se `RESEND_API_KEY` estiver configurada
- Se nao estiver configurada, apenas logar no console do edge function que o envio seria feito
- Retornar flag `email_sent: true/false` na resposta

No frontend (`CheckoutPanel.tsx` e `CheckoutDrawer.tsx`):
- Apos sucesso do checkout, exibir toast: "E-mail de confirmacao enviado para [email]"
- Logar no console os dados do e-mail (destinatario, evento, link do ticket)

## 4. Remocao de Mock Data da Home e EventDetail

- `Index.tsx`: Remover import e uso de `mockEvents`, exibir apenas eventos reais do banco. Buscar preco do lote mais barato via join com `ticket_batches`
- `EventDetail.tsx`: Buscar evento do banco pelo ID (UUID) em vez de `mockEvents`. Carregar lotes de ingressos disponiveis com precos reais
- `PurchaseSuccess.tsx`: Buscar dados do evento do banco em vez de `mockEvents`
- `MyTickets.tsx`: Buscar ingressos reais do banco vinculados ao e-mail do usuario logado

## 5. Revisao do Formulario de Criacao de Evento

- Verificar que `CreateEventForm.tsx` esta salvando corretamente no banco limpo (ja implementado, apenas validar)
- Garantir que o upload de imagem de capa funciona com o bucket `event-covers` existente

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Limpar dados ficticios
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
```

Para a confirmacao automatica de e-mail, sera utilizada a ferramenta de configuracao de auth para habilitar auto-confirm (ou alternativamente, o usuario precisara confirmar o e-mail normalmente).

### Arquivos a Criar
- `src/pages/SaibaMais.tsx` - Landing page B2B

### Arquivos a Modificar
- `src/App.tsx` - Adicionar rota /saiba-mais
- `src/pages/Index.tsx` - Remover mockEvents, usar apenas dados reais com precos
- `src/pages/EventDetail.tsx` - Buscar evento real do banco por UUID
- `src/pages/PurchaseSuccess.tsx` - Buscar evento do banco
- `src/pages/MyTickets.tsx` - Buscar ingressos reais do usuario
- `supabase/functions/create-checkout/index.ts` - Adicionar logica de e-mail preparada para Resend
- `src/components/checkout/CheckoutPanel.tsx` - Toast de e-mail apos sucesso
- `src/components/checkout/CheckoutDrawer.tsx` - Toast de e-mail apos sucesso

### Sequencia de Execucao
1. Executar migracao SQL (limpeza + trigger admin)
2. Habilitar auto-confirm de e-mail no auth
3. Criar pagina SaibaMais.tsx e adicionar rota
4. Atualizar paginas para usar dados reais (Index, EventDetail, MyTickets, PurchaseSuccess)
5. Atualizar edge function create-checkout com logica de e-mail
6. Atualizar componentes de checkout com toast de confirmacao

