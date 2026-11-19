import { describe, expect, it } from "vitest";
import {
  courtesyStatusLabel,
  describeCourtesyError,
  excludeCourtesies,
  isComplimentary,
  visibleProducerCourtesies,
} from "./courtesy";

describe("excludeCourtesies (vendas, receita e participantes)", () => {
  const tickets = [
    { id: "paid-1", is_complimentary: false },
    { id: "courtesy-organizer", is_complimentary: true },
    { id: "courtesy-admin", is_complimentary: true },
    { id: "legacy", is_complimentary: null },
    { id: "legacy-2" },
  ];

  it("remove toda cortesia e mantém ingressos pagos (inclusive linhas antigas sem a coluna)", () => {
    expect(excludeCourtesies(tickets).map((t) => t.id)).toEqual(["paid-1", "legacy", "legacy-2"]);
  });

  it("isComplimentary só é verdadeiro para true", () => {
    expect(isComplimentary({ is_complimentary: true })).toBe(true);
    expect(isComplimentary({ is_complimentary: false })).toBe(false);
    expect(isComplimentary({ is_complimentary: null })).toBe(false);
    expect(isComplimentary({})).toBe(false);
  });
});

describe("visibleProducerCourtesies", () => {
  it("o produtor só vê courtesy_type = 'organizer' (nunca 'admin')", () => {
    const rows = [
      { id: "a", courtesy_type: "admin" },
      { id: "b", courtesy_type: "organizer" },
      { id: "c", courtesy_type: null },
      { id: "d" },
    ];
    expect(visibleProducerCourtesies(rows).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("describeCourtesyError", () => {
  it("42501 vira aviso de permissão, sem campo", () => {
    expect(describeCourtesyError({ code: "42501", message: "Não autorizado" })).toEqual({
      message: "Você não tem permissão para emitir cortesias para este evento.",
    });
  });

  it("22023 aponta o campo correto", () => {
    expect(describeCourtesyError({ code: "22023", message: "CPF do convidado inválido" }).field).toBe("cpf");
    expect(describeCourtesyError({ code: "22023", message: "E-mail do convidado inválido" }).field).toBe("email");
    expect(describeCourtesyError({ code: "22023", message: "Nome do convidado inválido" }).field).toBe("name");
    expect(describeCourtesyError({ code: "22023", message: "Quantidade deve ser entre 1 e 20" }).field).toBe("quantity");
  });

  it("P0002 aponta o evento; erro desconhecido vira mensagem genérica", () => {
    expect(describeCourtesyError({ code: "P0002", message: "Evento não encontrado" }).field).toBe("event");
    expect(describeCourtesyError(null).message).toMatch(/Não foi possível emitir/);
  });
});

describe("courtesyStatusLabel", () => {
  it("Válida / Utilizada", () => {
    expect(courtesyStatusLabel("valid")).toBe("Válida");
    expect(courtesyStatusLabel("used")).toBe("Utilizada");
  });
});
