/**
 * Relatório de desempenho por indicação (Atléticas & Comissionados) — Roadmap 3.3.
 *
 * Regras (as mesmas do painel do organizador):
 *  - conta SOMENTE pedidos confirmados/pagos (pending, cancelled, refunded etc. ficam de fora);
 *  - faturamento = subtotal (valor dos ingressos), NUNCA a taxa da plataforma;
 *  - cortesias não têm pedido, então jamais entram aqui;
 *  - todos os grupos (cadastrados, códigos orgânicos e "Venda Direta") somam exatamente o total.
 * Valores são somados em centavos para evitar erro de ponto flutuante.
 */

export const CONFIRMED_PAYMENT_STATUSES = ["confirmed", "paid"] as const;

export interface ReportOrder {
  referred_by: string | null;
  quantity: number | null;
  subtotal?: number | string | null;
  total_amount?: number | string | null;
  platform_fee?: number | string | null;
  service_fee?: number | string | null;
  payment_status: string;
}

export interface ReportAffiliate {
  id: string;
  name: string;
  ref_code: string;
  commission_percent: number | string;
}

export type ReportRowKind = "registered" | "unregistered" | "direct";

export interface ReportRow {
  kind: ReportRowKind;
  /** Nome exibido: nome cadastrado, o próprio código (orgânico) ou "Venda Direta (sem link)". */
  name: string;
  /** Código do link (?ref=) ou null na venda direta. */
  code: string | null;
  commissionPercent: number;
  orders: number;
  tickets: number;
  revenueCents: number;
  commissionCents: number;
}

export interface ReferralReport {
  rows: ReportRow[];
  totals: { orders: number; tickets: number; revenueCents: number; commissionCents: number };
}

export const DIRECT_SALE_LABEL = "Venda Direta (sem link)";

const toCents = (value: number | string | null | undefined) => Math.round(Number(value ?? 0) * 100);

/** Faturamento do pedido em centavos: subtotal; se ausente, total - taxa (como no painel). */
export function orderRevenueCents(order: ReportOrder): number {
  if (order.subtotal != null) return toCents(order.subtotal);
  const fee = Number(order.platform_fee ?? order.service_fee ?? 0);
  return toCents(Number(order.total_amount ?? 0) - fee);
}

const isConfirmed = (order: ReportOrder) =>
  (CONFIRMED_PAYMENT_STATUSES as readonly string[]).includes(order.payment_status);

const normalizeCode = (code: string | null | undefined) => {
  const trimmed = (code ?? "").trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
};

export function buildReferralReport(orders: ReportOrder[], affiliates: ReportAffiliate[]): ReferralReport {
  const registered = new Map(affiliates.map((a) => [a.ref_code.trim().toLowerCase(), a]));

  type Acc = { orders: number; tickets: number; revenueCents: number };
  const groups = new Map<string | null, Acc>();
  const totals = { orders: 0, tickets: 0, revenueCents: 0 };

  for (const order of orders) {
    if (!isConfirmed(order)) continue;
    const key = normalizeCode(order.referred_by);
    const acc = groups.get(key) ?? { orders: 0, tickets: 0, revenueCents: 0 };
    const tickets = Number(order.quantity ?? 0);
    const revenueCents = orderRevenueCents(order);
    acc.orders += 1;
    acc.tickets += tickets;
    acc.revenueCents += revenueCents;
    groups.set(key, acc);
    totals.orders += 1;
    totals.tickets += tickets;
    totals.revenueCents += revenueCents;
  }

  const empty: Acc = { orders: 0, tickets: 0, revenueCents: 0 };
  const commissionOf = (revenueCents: number, percent: number) => Math.round((revenueCents * percent) / 100);

  const rows: ReportRow[] = [];

  // 1) cadastrados (aparecem mesmo sem vendas), em ordem alfabética
  [...affiliates]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .forEach((affiliate) => {
      const code = affiliate.ref_code.trim().toLowerCase();
      const acc = groups.get(code) ?? empty;
      const commissionPercent = Number(affiliate.commission_percent) || 0;
      rows.push({
        kind: "registered",
        name: affiliate.name,
        code,
        commissionPercent,
        ...acc,
        commissionCents: commissionOf(acc.revenueCents, commissionPercent),
      });
    });

  // 2) códigos "orgânicos": usados em links mas não cadastrados (sem comissão definida)
  [...groups.keys()]
    .filter((key): key is string => key !== null && !registered.has(key))
    .sort()
    .forEach((code) => {
      rows.push({
        kind: "unregistered",
        name: code,
        code,
        commissionPercent: 0,
        ...(groups.get(code) as Acc),
        commissionCents: 0,
      });
    });

  // 3) venda direta (sem ?ref=)
  const direct = groups.get(null) ?? empty;
  rows.push({
    kind: "direct",
    name: DIRECT_SALE_LABEL,
    code: null,
    commissionPercent: 0,
    ...direct,
    commissionCents: 0,
  });

  return {
    rows,
    totals: { ...totals, commissionCents: rows.reduce((sum, row) => sum + row.commissionCents, 0) },
  };
}

/* ---------------------------------- CSV ---------------------------------- */

export const CSV_HEADER = [
  "Atlética / Comissionado",
  "Código (?ref=)",
  "Pedidos Confirmados",
  "Ingressos Vendidos",
  "Faturamento Gerado (R$)",
  "Comissão Estimada (R$)",
] as const;

/** 12345 -> "123,45" (vírgula decimal, sem separador de milhar: o Excel pt-BR lê como número). */
export const centsToCsvNumber = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Escapa a célula e neutraliza "injeção de fórmula" (=, +, -, @) em planilhas. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const BOM = "\uFEFF";

/** CSV com BOM UTF-8, separador ";" e quebra de linha CRLF — abre direto no Excel do Brasil. */
export function referralReportToCsv(report: ReferralReport): string {
  const lines = [CSV_HEADER.map(csvCell).join(";")];
  for (const row of report.rows) {
    lines.push(
      [
        row.name,
        row.code ?? "",
        row.orders,
        row.tickets,
        centsToCsvNumber(row.revenueCents),
        centsToCsvNumber(row.commissionCents),
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  lines.push(
    [
      "Total",
      "",
      report.totals.orders,
      report.totals.tickets,
      centsToCsvNumber(report.totals.revenueCents),
      centsToCsvNumber(report.totals.commissionCents),
    ]
      .map(csvCell)
      .join(";"),
  );
  return BOM + lines.join("\r\n") + "\r\n";
}
