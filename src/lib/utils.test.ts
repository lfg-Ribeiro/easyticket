import { describe, expect, it } from "vitest";
import { formatEventDate, parseEventDate } from "./utils";

describe("parseEventDate / formatEventDate", () => {
  it("mantém o dia do banco, sem recuar um dia", () => {
    const date = parseEventDate("2026-11-21");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(21);
    expect(formatEventDate("2026-11-21")).toBe("21/11/2026");
  });

  it("aceita timestamp ISO começando pela data", () => {
    expect(formatEventDate("2026-11-21T00:00:00+00:00")).toBe("21/11/2026");
  });

  it("usa fallback para valor vazio ou inválido", () => {
    expect(formatEventDate("")).toBe("Data a definir");
    expect(formatEventDate(null)).toBe("Data a definir");
    expect(formatEventDate("abc")).toBe("Data a definir");
  });
});