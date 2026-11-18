/**
 * Leitura e formatação dos dados da página pós-compra (/purchase-success e /obrigado).
 *
 * O checkout envia os parâmetros em camelCase (eventId, orderId, paymentId, qrCode, txn…).
 * Os equivalentes em snake_case (event_id, order_id…) também são aceitos como alias.
 */

export interface PurchaseParams {
  eventId: string;
  orderId: string;
  paymentId: string;
  qrCode: string;
  transactionId: string;
  name: string;
  email: string;
  quantity: number;
  /** Total exibido no checkout; usado só quando o pedido não pode ser lido do banco (convidado). */
  total: number | null;
  batchName: string;
}

const pick = (params: URLSearchParams, ...keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return "";
};

export function readPurchaseParams(params: URLSearchParams): PurchaseParams {
  const quantity = parseInt(pick(params, "quantity", "qty"), 10);
  const totalParam = pick(params, "total").replace(",", ".");
  const total = totalParam === "" ? NaN : Number(totalParam);

  return {
    eventId: pick(params, "eventId", "event_id"),
    orderId: pick(params, "orderId", "order_id"),
    paymentId: pick(params, "paymentId", "payment_id"),
    qrCode: pick(params, "qrCode", "qr_code"),
    transactionId: pick(params, "txn", "transaction_id"),
    name: pick(params, "name"),
    email: pick(params, "email"),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    total: Number.isFinite(total) && total >= 0 ? total : null,
    batchName: pick(params, "batch"),
  };
}

/** Referência curta do pedido: "#A1B2C3D4" (a partir do id) ou o id da transação. */
export function formatOrderRef(orderId?: string | null, transactionId?: string | null): string | null {
  const fromOrder = (orderId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  if (fromOrder) return `#${fromOrder}`;
  const fromTxn = (transactionId ?? "").trim().toUpperCase();
  return fromTxn || null;
}

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/** URL pública do evento para compartilhar. */
export const buildEventUrl = (eventId: string, origin: string = window.location.origin) =>
  `${origin}/event/${eventId}`;
