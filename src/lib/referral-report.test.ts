import { describe, expect, it } from "vitest";
import {
  CSV_HEADER,
  buildReferralReport,
  csvCell,
  orderRevenueCents,
  referralReportToCsv,
  type ReportAffiliate,
  type ReportOrder,
} from "./referral-report";

const order = (o: Partial<ReportOrder> & { payment_status: string }): ReportOrder => ({
  referred_by: null,
  quantity: 1,
  subtotal: 0,
  ...o,
});

const affiliates: ReportAffiliate[] = [
  { id: "a1", name: "Atlética Engenharia", ref_code: "atletica_engenharia", commission_percent: 10 },
  { id: "a2", name: "Promoter João", ref_code: "promoter_joao", commission_percent: "7.5" },
];

const orders: ReportOrder[] = [
  order({ payment_status: "confirmed", referred_by: "atletica_engenharia", quantity: 2, subtotal: 100 }),
  order({ payment_status: "paid", referred_by: "atletica_engenharia", quantity: 1, subtotal: 50 }),
  order({ payment_status: "confirmed", referred_by: " ATLETICA_ENGENHARIA ", quantity: 1, subtotal: 33.33 }), // normalizado
  order({ payment_status: "confirmed", referred_by: null, quantity: 3, subtotal: 150 }),
  order({ payment_status: "confirmed", referred_by: "", quantity: 1, subtotal: 10 }), // vazio = venda direta
  order({ payment_status: "confirmed", referred_by: "promoter_x", quantity: 4, subtotal: 200 }), // orgânico
  // ficam de fora:
  order({ payment_status: "pending", referred_by: "atletica_engenharia", quantity: 9, subtotal: 900 }),
  order({ payment_status: "cancelled", referred_by: "promoter_x", quantity: 9, subtotal: 900 }),
  order({ payment_status: "refunded", referred_by: null, quantity: 9, subtotal: 900 }),
  order({ payment_status: "expired", referred_by: "promoter_joao", quantity: 9, subtotal: 900 }),
];

describe("buildReferralReport", () => {
  const report = buildReferralReport(orders, affiliates);
  const row = (code: string | null) => report.rows.find((r) => r.code === code)!;

  it("conta só pedidos confirmados/pagos (pending, cancelled, refunded, expired ficam de fora)", () => {
    expect(report.totals.orders).toBe(6);
    expect(report.totals.tickets).toBe(12);
  });

  it("cadastrado: nome, pedidos, ingressos, faturamento e comissão exata em centavos", () => {
    const atletica = row("atletica_engenharia");
    expect(atletica.kind).toBe("registered");
    expect(atletica.name).toBe("Atlética Engenharia");
    expect(atletica.orders).toBe(3); // inclui o código com maiúsculas/espaços
    expect(atletica.tickets).toBe(4);
    expect(atletica.revenueCents).toBe(18333);
    expect(atletica.commissionPercent).toBe(10);
    expect(atletica.commissionCents).toBe(1833); // 10% de R$ 183,33 = 18,333 -> 18,33
  });

  it("cadastrado sem vendas aparece com zeros", () => {
    const joao = row("promoter_joao");
    expect(joao).toMatchObject({ kind: "registered", orders: 0, tickets: 0, revenueCents: 0, commissionCents: 0, commissionPercent: 7.5 });
  });

  it("código orgânico (não cadastrado) aparece com o próprio código e sem comissão", () => {
    expect(row("promoter_x")).toMatchObject({
      kind: "unregistered",
      name: "promoter_x",
      orders: 1,
      tickets: 4,
      revenueCents: 20000,
      commissionCents: 0,
    });
  });

  it("venda direta (sem link ou vazio) é a última linha", () => {
    const direct = report.rows[report.rows.length - 1];
    expect(direct).toMatchObject({ kind: "direct", name: "Venda Direta (sem link)", code: null, orders: 2, tickets: 4, revenueCents: 16000 });
  });

  it("todos os grupos fecham 100% com o total confirmado do evento", () => {
    const sum = (key: "orders" | "tickets" | "revenueCents") => report.rows.reduce((s, r) => s + r[key], 0);
    expect(sum("orders")).toBe(report.totals.orders);
    expect(sum("tickets")).toBe(report.totals.tickets);
    expect(sum("revenueCents")).toBe(report.totals.revenueCents);

    // total independente, direto dos pedidos confirmados
    const confirmed = orders.filter((o) => ["confirmed", "paid"].includes(o.payment_status));
    expect(report.totals.orders).toBe(confirmed.length);
    expect(report.totals.tickets).toBe(confirmed.reduce((s, o) => s + Number(o.quantity), 0));
    expect(report.totals.revenueCents).toBe(Math.round(confirmed.reduce((s, o) => s + Number(o.subtotal), 0) * 100));
    expect(report.totals.revenueCents).toBe(54333);
  });

  it("comissão total = soma das comissões dos cadastrados", () => {
    expect(report.totals.commissionCents).toBe(1833);
  });

  it("não acumula erro de ponto flutuante (0,10 + 0,20 = R$ 0,30)", () => {
    const r = buildReferralReport(
      [order({ payment_status: "confirmed", subtotal: 0.1 }), order({ payment_status: "confirmed", subtotal: 0.2 })],
      [],
    );
    expect(r.totals.revenueCents).toBe(30);
  });

  it("sem pedidos: só os cadastrados e a venda direta, tudo zerado", () => {
    const r = buildReferralReport([], affiliates);
    expect(r.rows.map((x) => x.kind)).toEqual(["registered", "registered", "direct"]);
    expect(r.totals).toEqual({ orders: 0, tickets: 0, revenueCents: 0, commissionCents: 0 });
  });

  it("faturamento é o subtotal; sem subtotal, total - taxa (nunca inclui a taxa da plataforma)", () => {
    expect(orderRevenueCents(order({ payment_status: "paid", subtotal: 100, total_amount: 105, platform_fee: 5 }))).toBe(10000);
    expect(
      orderRevenueCents({ referred_by: null, quantity: 1, subtotal: null, total_amount: 105, platform_fee: 5, payment_status: "paid" }),
    ).toBe(10000);
  });
});

describe("CSV", () => {
  const report = buildReferralReport(orders, affiliates);
  const csv = referralReportToCsv(report);

  it("começa com BOM UTF-8, usa ';' e CRLF (abre direto no Excel do Brasil)", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0].slice(1)).toBe(CSV_HEADER.join(";"));
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("valores com vírgula decimal e linha de total", () => {
    const lines = csv.split("\r\n");
    expect(lines).toContain("Atlética Engenharia;atletica_engenharia;3;4;183,33;18,33");
    expect(lines).toContain("promoter_x;promoter_x;1;4;200,00;0,00");
    expect(lines).toContain("Venda Direta (sem link);;2;4;160,00;0,00");
    expect(lines).toContain("Total;;6;12;543,33;18,33");
  });

  it("neutraliza injeção de fórmula e escapa ; e aspas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+55 11")).toBe("'+55 11");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("Atlética; Eng")).toBe('"Atlética; Eng"');
    expect(csvCell('Ele disse "oi"')).toBe('"Ele disse ""oi"""');
    expect(csvCell(12)).toBe("12");
  });
});
