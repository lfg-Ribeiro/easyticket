import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REFERRAL_TTL_MS,
  buildReferralLink,
  captureReferralFromUrl,
  clearStoredReferral,
  getStoredReferral,
  normalizeRefCode,
  readRefFromSearch,
  suggestRefCode,
} from "./referral";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("normalizeRefCode", () => {
  it.each([
    ["Atlética Engenharia", "atletica_engenharia"],
    ["  ÁTLÉTICA   Eng. Civil!! ", "atletica_eng_civil"],
    ["Ação & Reação/2026", "acao_reacao_2026"],
    ["atletica-engenharia", "atletica_engenharia"],
    ["ATLETICA_ENGENHARIA", "atletica_engenharia"],
    ["Promoter João #1", "promoter_joao_1"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeRefCode(input)).toBe(expected);
  });

  it("vazio, nulo ou só símbolos viram string vazia", () => {
    expect(normalizeRefCode("")).toBe("");
    expect(normalizeRefCode(null)).toBe("");
    expect(normalizeRefCode(undefined)).toBe("");
    expect(normalizeRefCode(" _-_ !!! ")).toBe("");
  });

  it("limita a 64 caracteres, sem terminar em '_'", () => {
    const long = normalizeRefCode(`${"a".repeat(63)} b`);
    expect(long.length).toBeLessThanOrEqual(64);
    expect(long.endsWith("_")).toBe(false);
    expect(normalizeRefCode("x".repeat(200))).toHaveLength(64);
  });

  it("é idempotente e coerente com a sugestão a partir do nome", () => {
    const once = normalizeRefCode("Atlética Eng. Civil");
    expect(normalizeRefCode(once)).toBe(once);
    expect(suggestRefCode("Atlética Eng. Civil")).toBe(once);
  });
});

describe("readRefFromSearch / utm_source", () => {
  it("?ref= tem prioridade sobre ?utm_source=", () => {
    expect(readRefFromSearch("?utm_source=Instagram&ref=Atlética Engenharia")).toBe("atletica_engenharia");
  });

  it("?utm_source= vale quando não há ?ref=, ou quando ele está vazio", () => {
    expect(readRefFromSearch("?utm_source=Instagram")).toBe("instagram");
    expect(readRefFromSearch("?ref=&utm_source=Instagram")).toBe("instagram");
  });

  it("sem parâmetros, devolve vazio", () => {
    expect(readRefFromSearch("")).toBe("");
    expect(readRefFromSearch("?foo=bar")).toBe("");
  });
});

describe("captureReferralFromUrl + getStoredReferral", () => {
  it("guarda por evento e devolve o código normalizado", () => {
    expect(captureReferralFromUrl("?ref=Atlética Engenharia", "e1")).toBe("atletica_engenharia");
    expect(getStoredReferral("e1")).toBe("atletica_engenharia");
  });

  it("sobrevive ao redirecionamento para /auth (login/cadastro) e à volta ao checkout", () => {
    // 1) usuário chega pelo link da atlética
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    // 2) vai para /auth e volta para o evento SEM ?ref= na URL
    expect(captureReferralFromUrl("", "e1")).toBeNull();
    expect(captureReferralFromUrl("?next=%2Fevent%2Fe1")).toBeNull();
    // 3) a indicação continua lá, para o checkout
    expect(getStoredReferral("e1")).toBe("atletica_engenharia");
  });

  it("URL sem indicação não sobrescreve a que já estava guardada", () => {
    captureReferralFromUrl("?ref=primeira", "e1");
    captureReferralFromUrl("?foo=bar", "e1");
    expect(getStoredReferral("e1")).toBe("primeira");
  });

  it("um novo ?ref= no mesmo evento substitui o anterior", () => {
    captureReferralFromUrl("?ref=primeira", "e1");
    captureReferralFromUrl("?ref=segunda", "e1");
    expect(getStoredReferral("e1")).toBe("segunda");
  });

  it("reserva global: capturada fora de um evento vale para qualquer evento", () => {
    captureReferralFromUrl("?ref=promoter_joao");
    expect(getStoredReferral("e1")).toBe("promoter_joao");
    expect(getStoredReferral("e2")).toBe("promoter_joao");
    expect(getStoredReferral()).toBe("promoter_joao");
  });

  it("a indicação de um evento NÃO vaza para a compra de outro evento", () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    expect(getStoredReferral("e2")).toBeNull();
    expect(getStoredReferral("e1")).toBe("atletica_engenharia");
    expect(getStoredReferral()).toBe("atletica_engenharia");
  });

  it("expira em 7 dias (por evento e global)", () => {
    const t0 = 1_700_000_000_000;
    captureReferralFromUrl("?ref=atletica_engenharia", "e1", t0);
    expect(getStoredReferral("e1", t0 + REFERRAL_TTL_MS)).toBe("atletica_engenharia");
    expect(getStoredReferral("e1", t0 + REFERRAL_TTL_MS + 1)).toBeNull();
    expect(getStoredReferral(undefined, t0 + REFERRAL_TTL_MS + 1)).toBeNull();
    // entradas vencidas são removidas
    expect(localStorage.length).toBe(0);
  });

  it("clearStoredReferral limpa o evento (e a reserva global dele); sem argumento, tudo", () => {
    captureReferralFromUrl("?ref=a", "e1");
    captureReferralFromUrl("?ref=b", "e2");
    clearStoredReferral("e1");
    expect(getStoredReferral("e1")).toBeNull();
    expect(getStoredReferral("e2")).toBe("b");
    clearStoredReferral();
    expect(getStoredReferral("e2")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("dados corrompidos no storage são ignorados sem quebrar", () => {
    localStorage.setItem("easyticket:ref:event:e1", "{não é json");
    localStorage.setItem("easyticket:ref:global", JSON.stringify({ code: 123 }));
    expect(getStoredReferral("e1")).toBeNull();
  });

  it("storage indisponível (modo privado/quota): captura não lança erro", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => captureReferralFromUrl("?ref=atletica", "e1")).not.toThrow();
  });
});

describe("buildReferralLink", () => {
  it("monta o link público do evento com ?ref=", () => {
    expect(buildReferralLink("e1", "atletica_engenharia", "https://www.easyticket.dev.br")).toBe(
      "https://www.easyticket.dev.br/event/e1?ref=atletica_engenharia",
    );
  });
});
