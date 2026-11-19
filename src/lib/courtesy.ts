import type { CourtesyField } from "@/lib/validation";

/** Linha de cortesia exibida na aba "Cortesias" do produtor. */
export interface CourtesyTicket {
  id: string;
  event_id: string;
  qr_code: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_cpf: string | null;
  check_in_status: string;
  courtesy_type: string | null;
  is_complimentary?: boolean | null;
  created_at: string;
}

interface Complimentary {
  is_complimentary?: boolean | null;
}

export const isComplimentary = (ticket: Complimentary) => ticket.is_complimentary === true;

/**
 * Remove cortesias de qualquer lista que alimente vendas, receita ou participantes.
 * Cortesia NUNCA conta como "Ingresso Vendido" nem entra na receita / taxa de 5%.
 */
export function excludeCourtesies<T extends Complimentary>(tickets: T[]): T[] {
  return tickets.filter((ticket) => !isComplimentary(ticket));
}

/**
 * Cortesias que o PRODUTOR pode ver: somente courtesy_type = 'organizer'.
 * As cortesias 'admin' (dos donos da plataforma) são invisíveis para o produtor — o RLS já as
 * esconde no banco; este filtro é a segunda barreira, caso alguma consulta mude no futuro.
 */
export function visibleProducerCourtesies<T extends { courtesy_type?: string | null }>(tickets: T[]): T[] {
  return tickets.filter((ticket) => ticket.courtesy_type === "organizer");
}

export const courtesyStatusLabel = (checkInStatus: string) =>
  checkInStatus === "used" ? "Utilizada" : "Válida";

interface RpcError {
  code?: string;
  message?: string;
}

export interface CourtesyErrorInfo {
  /** Campo do formulário ao qual o erro se refere (quando houver). */
  field?: CourtesyField;
  message: string;
}

/** Traduz erros das RPCs de cortesia (códigos do Postgres) em mensagens para o usuário. */
export function describeCourtesyError(error: RpcError | null | undefined): CourtesyErrorInfo {
  const code = error?.code;
  const raw = error?.message ?? "";

  if (code === "42501") {
    return { message: "Você não tem permissão para emitir cortesias para este evento." };
  }
  if (code === "P0002") {
    return { field: "event", message: "Evento não encontrado ou removido." };
  }
  if (code === "22023") {
    if (/cpf/i.test(raw)) return { field: "cpf", message: "CPF inválido. Confira os números digitados" };
    if (/e-?mail/i.test(raw)) return { field: "email", message: "Informe um e-mail válido, como nome@email.com" };
    if (/nome/i.test(raw)) return { field: "name", message: "Informe o nome do convidado" };
    if (/quantidade/i.test(raw)) return { field: "quantity", message: raw };
  }
  return { message: "Não foi possível emitir a cortesia. Tente novamente em instantes." };
}
