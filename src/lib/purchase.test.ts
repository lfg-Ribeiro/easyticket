import { describe, expect, it } from "vitest";
import { buildEventUrl, formatBRL, formatOrderRef, readPurchaseParams } from "./purchase";

const read = (query: string) => readPurchaseParams(new URLSearchParams(query));

describe("readPurchaseParams", () => {
  it("lê os parâmetros camelCase enviados pelo checkout", () => {
    expect(
      read("eventId=e1&name=Ana+Souza&email=ana%40email.com&quantity=2&txn=TXN-1&paymentId=pay_1&orderId=o1&qrCode=QR1&total=105.00&batch=Lote+1"),
    ).toEqual({
      eventId: "e1",
      orderId: "o1",
      paymentId: "pay_1",
      qrCode: "QR1",
      transactionId: "TXN-1",
      name: "Ana Souza",
      email: "ana@email.com",
      quantity: 2,
      total: 105,
      batchName: "Lote 1",
    });
  });

  it("aceita os aliases em snake_case", () => {
    const params = read("event_id=e1&order_id=o1&payment_id=p1&qr_code=QR1&transaction_id=T1");
    expect(params).toMatchObject({ eventId: "e1", orderId: "o1", paymentId: "p1", qrCode: "QR1", transactionId: "T1" });
  });

  it("camelCase tem prioridade sobre o alias", () => {
    expect(read("orderId=a&order_id=b").orderId).toBe("a");
  });

  it("usa padrões seguros para valores ausentes ou inválidos", () => {
    const params = read("quantity=abc&total=xyz");
    expect(params.quantity).toBe(1);
    expect(params.total).toBeNull();
    expect(read("quantity=-3").quantity).toBe(1);
    expect(read("total=0").total).toBe(0);
    expect(read("total=12,5").total).toBe(12.5);
    expect(read("").eventId).toBe("");
  });
});

describe("formatOrderRef / formatBRL / buildEventUrl", () => {
  it("gera uma referência curta e legível do pedido", () => {
    expect(formatOrderRef("a1b2c3d4-0000-4000-8000-000000000000")).toBe("#A1B2C3D4");
    expect(formatOrderRef("", "txn-abc")).toBe("TXN-ABC");
    expect(formatOrderRef(undefined, undefined)).toBeNull();
  });

  it("formata moeda em reais", () => {
    expect(formatBRL(105)).toMatch(/^R\$\s105,00$/);
  });

  it("monta a URL pública do evento", () => {
    expect(buildEventUrl("e1", "https://www.easyticket.dev.br")).toBe("https://www.easyticket.dev.br/event/e1");
  });
});
