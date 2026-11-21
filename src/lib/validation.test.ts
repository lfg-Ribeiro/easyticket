import { describe, expect, it } from "vitest";
import {
  formatPhone,
  isValidCpf,
  isValidEmail,
  updateBatchFieldError,
  formatCpf,
  validateCourtesy,
  validateCourtesyQuantity,
  parseCommissionPercent,
  validateAffiliate,
  validateCommissionPercent,
  validateRefCode,
  validateBatch,
  validateBatchRows,
  validateBuyer,
  validateCard,
  validateCardExpiry,
  validateCpf,
  validateEventBasics,
  validateFullName,
  validateNewPassword,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from "./validation";

describe("CPF", () => {
  it.each(["529.982.247-25", "52998224725", "123.456.789-09", "111.444.777-35"])(
    "aceita CPF válido %s",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
      expect(validateCpf(cpf)).toBeUndefined();
    },
  );

  it.each(["111.111.111-11", "000.000.000-00", "123.456.789-10", "529.982.247-24"])(
    "rejeita CPF com dígitos repetidos ou verificador errado: %s",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
      expect(validateCpf(cpf)).toBe("CPF inválido. Confira os números digitados");
    },
  );

  it("diferencia vazio, incompleto e inválido", () => {
    expect(validateCpf("")).toBe("Informe seu CPF");
    expect(validateCpf("", { required: false })).toBeUndefined();
    expect(validateCpf("123.456")).toBe("O CPF deve ter 11 dígitos");
  });
});

describe("telefone", () => {
  it("aceita 10 e 11 dígitos com DDD válido", () => {
    expect(validatePhone("(11) 99999-8888")).toBeUndefined();
    expect(validatePhone("(45) 3523-1234")).toBeUndefined();
  });

  it("rejeita tamanho e DDD inválidos", () => {
    expect(validatePhone("")).toBe("Informe seu telefone");
    expect(validatePhone("", { required: false })).toBeUndefined();
    expect(validatePhone("(11) 9999-888")).toBe("Informe o telefone com DDD (10 ou 11 dígitos)");
    expect(validatePhone("(05) 99999-8888")).toBe("DDD inválido");
  });

  it("aplica a máscara", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
  });
});

describe("nome, e-mail e senha", () => {
  it("exige nome e sobrenome", () => {
    expect(validateFullName("")).toBe("Informe seu nome completo");
    expect(validateFullName("Ana")).toBe("Informe nome e sobrenome");
    expect(validateFullName("Ana 2")).toBe("O nome não pode conter números");
    expect(validateFullName("Ana Souza")).toBeUndefined();
    expect(validateFullName("  José A. da Silva ")).toBeUndefined();
  });

  it("valida formato de e-mail", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    ["a@b", "a b@c.com", "@c.com", "abc"].forEach((email) => expect(isValidEmail(email)).toBe(false));
  });

  it("senha: mínimo de 6 e confirmação", () => {
    expect(validatePassword("12345")).toBe("A senha deve ter pelo menos 6 caracteres");
    expect(validatePassword("12345", { checkLength: false })).toBeUndefined();
    expect(validatePassword("123456")).toBeUndefined();
    expect(validateNewPassword("")).toBe("Informe a nova senha");
    expect(validatePasswordConfirmation("123456", "")).toBe("Confirme a nova senha");
    expect(validatePasswordConfirmation("123456", "1234567")).toBe("As senhas não conferem");
    expect(validatePasswordConfirmation("123456", "123456")).toBeUndefined();
  });
});

describe("comprador e cartão", () => {
  it("validateBuyer só devolve os campos inválidos", () => {
    expect(
      validateBuyer({ name: "Ana", email: "a@b.com", cpf: "529.982.247-25", phone: "(11) 99999-8888" }),
    ).toEqual({ name: "Informe nome e sobrenome" });
    expect(validateBuyer({ name: "Ana Souza", email: "a@b.com", cpf: "529.982.247-25", phone: "(11) 99999-8888" })).toEqual({});
  });

  it("validade do cartão considera mês e vencimento", () => {
    const now = new Date(2026, 10, 17); // nov/2026
    expect(validateCardExpiry("11/26", now)).toBeUndefined();
    expect(validateCardExpiry("10/26", now)).toBe("Cartão vencido");
    expect(validateCardExpiry("13/30", now)).toBe("Mês inválido");
    expect(validateCardExpiry("1/3", now)).toBe("Use o formato MM/AA");
  });

  it("validateCard aponta todos os campos vazios", () => {
    expect(Object.keys(validateCard({ number: "", holderName: "", expiry: "", cvv: "" }))).toEqual([
      "cardNumber",
      "holderName",
      "expiry",
      "cvv",
    ]);
  });
});

describe("evento e lotes", () => {
  it("etapa 1 exige título, categoria, data, horário e local", () => {
    expect(Object.keys(validateEventBasics({ title: " ", category: "", date: "", time: "", location: "" }))).toEqual([
      "title",
      "category",
      "date",
      "time",
      "location",
    ]);
  });

  it("lote: preço >= 0 e quantidade >= 1 inteira", () => {
    expect(validateBatch({ name: "Lote 1", price: "0", quantity: "1" })).toEqual({});
    expect(validateBatch({ name: "", price: "", quantity: "" })).toEqual({
      name: "Informe o nome do lote",
      price: "Informe o preço (use 0 para ingresso gratuito)",
      quantity: "Informe a quantidade",
    });
    expect(validateBatch({ name: "L", price: "-1", quantity: "0" })).toEqual({
      price: "O preço não pode ser negativo",
      quantity: "A quantidade mínima é 1",
    });
    expect(validateBatch({ name: "L", price: "10", quantity: "2.5" }).quantity).toBe("Use um número inteiro");
  });

  it("na edição, a quantidade não pode ficar abaixo do já vendido", () => {
    expect(validateBatch({ name: "L", price: "10", quantity: "5" }, 10).quantity).toBe(
      "Já foram vendidos 10 ingressos neste lote; a quantidade não pode ser menor",
    );
    expect(validateBatch({ name: "L", price: "10", quantity: "10" }, 10)).toEqual({});
  });

  it("validateBatchRows indica a linha exata e exige ao menos um lote", () => {
    const { rowErrors, general } = validateBatchRows([
      { key: "a", name: "Lote 1", price: "10", quantity: "5" },
      { key: "b", name: "Lote 2", price: "", quantity: "5" },
    ]);
    expect(Object.keys(rowErrors)).toEqual(["b"]);
    expect(general).toBeUndefined();
    expect(validateBatchRows([]).general).toBe("Adicione pelo menos um lote de ingressos");
    expect(validateBatchRows([], { requireAtLeastOne: false }).general).toBeUndefined();
  });

  it("updateBatchFieldError limpa o campo corrigido e a linha quando não restam erros", () => {
    const prev = { b: { price: "x", quantity: "y" } };
    const afterPrice = updateBatchFieldError(prev, "b", "price", undefined);
    expect(afterPrice).toEqual({ b: { quantity: "y" } });
    expect(updateBatchFieldError(afterPrice, "b", "quantity", undefined)).toEqual({});
    // campo que não tinha erro não é afetado
    expect(updateBatchFieldError(prev, "b", "name", "novo")).toBe(prev);
  });
});

describe("cortesias", () => {
  it("quantidade: inteiro entre 1 e 20", () => {
    expect(validateCourtesyQuantity("")).toBe("Informe a quantidade");
    expect(validateCourtesyQuantity("0")).toBe("A quantidade mínima é 1");
    expect(validateCourtesyQuantity("21")).toBe("A quantidade máxima é 20");
    expect(validateCourtesyQuantity("2.5")).toBe("Use um número inteiro");
    expect(validateCourtesyQuantity("1")).toBeUndefined();
    expect(validateCourtesyQuantity("20")).toBeUndefined();
  });

  it("formulário exige evento, nome e sobrenome, e-mail, CPF válido e quantidade", () => {
    expect(Object.keys(validateCourtesy({ eventId: "", name: "", email: "", cpf: "", quantity: "" }))).toEqual([
      "event",
      "name",
      "email",
      "cpf",
      "quantity",
    ]);
    expect(
      validateCourtesy({ eventId: "e1", name: "Ana Souza", email: "ana@email.com", cpf: "529.982.247-25", quantity: "2" }),
    ).toEqual({});
    expect(
      validateCourtesy({ eventId: "e1", name: "Ana Souza", email: "ana@email.com", cpf: "111.111.111-11", quantity: "2" }).cpf,
    ).toBe("CPF inválido. Confira os números digitados");
  });

  it("máscara de CPF", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529")).toBe("529");
  });
});

describe("comissionados / atléticas", () => {
  it("código do link: minúsculas, números e _ (2 a 64)", () => {
    expect(validateRefCode("")).toBe("Informe o código do link");
    expect(validateRefCode("Atletica")).toMatch(/apenas letras minúsculas/);
    expect(validateRefCode("atlética")).toMatch(/apenas letras minúsculas/);
    expect(validateRefCode("a b")).toMatch(/apenas letras minúsculas/);
    expect(validateRefCode("a")).toBe("O código deve ter pelo menos 2 caracteres");
    expect(validateRefCode("a".repeat(65))).toBe("Código muito longo (máx. 64 caracteres)");
    expect(validateRefCode("atletica_engenharia")).toBeUndefined();
  });

  it("comissão: opcional, de 0 a 100, vírgula ou ponto, até 2 casas", () => {
    expect(validateCommissionPercent("")).toBeUndefined();
    expect(validateCommissionPercent("0")).toBeUndefined();
    expect(validateCommissionPercent("7,5")).toBeUndefined();
    expect(validateCommissionPercent("100")).toBeUndefined();
    expect(validateCommissionPercent("100,01")).toBe("A comissão deve ficar entre 0% e 100%");
    expect(validateCommissionPercent("-5")).toMatch(/percentual válido/);
    expect(validateCommissionPercent("abc")).toMatch(/percentual válido/);
    expect(validateCommissionPercent("10,123")).toMatch(/percentual válido/);
    expect(parseCommissionPercent("7,5")).toBe(7.5);
    expect(parseCommissionPercent("")).toBe(0);
  });

  it("formulário exige nome e código; comissão é opcional", () => {
    expect(Object.keys(validateAffiliate({ name: "", refCode: "", commission: "" }))).toEqual(["name", "refCode"]);
    expect(validateAffiliate({ name: "Atlética Engenharia", refCode: "atletica_engenharia", commission: "" })).toEqual({});
  });
});
