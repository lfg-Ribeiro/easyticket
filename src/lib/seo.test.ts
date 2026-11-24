import { describe, expect, it } from "vitest";
import {
  EVENT_FALLBACK_COVER,
  absoluteUrl,
  buildEventMeta,
  cleanCanonicalUrl,
  getSiteOrigin,
  pageTitle,
} from "./seo";

const origin = "https://www.easyticket.dev.br";
const baseEvent = {
  title: "Festa Universitária",
  date: "2026-12-01",
  venue: "Arena Iguaçu",
  location: "Foz do Iguaçu",
  image: "https://cdn.example.com/capa.jpg",
  price: 50,
};

describe("helpers de URL", () => {
  it("pageTitle segue o padrão 'Página | EasyTicket'", () => {
    expect(pageTitle("Meus Ingressos")).toBe("Meus Ingressos | EasyTicket");
  });

  it("em produção (apex ou www) o canônico é sempre www; fora dela, a própria origem", () => {
    expect(getSiteOrigin({ hostname: "easyticket.dev.br", origin: "https://easyticket.dev.br" })).toBe(origin);
    expect(getSiteOrigin({ hostname: "www.easyticket.dev.br", origin: "https://www.easyticket.dev.br" })).toBe(origin);
    expect(getSiteOrigin({ hostname: "localhost", origin: "http://localhost:8080" })).toBe("http://localhost:8080");
    expect(getSiteOrigin({ hostname: "preview-abc.lovable.app", origin: "https://preview-abc.lovable.app" })).toBe(
      "https://preview-abc.lovable.app",
    );
  });

  it("absoluteUrl resolve caminhos e mantém URLs absolutas", () => {
    expect(absoluteUrl("/og-image.png", origin)).toBe(`${origin}/og-image.png`);
    expect(absoluteUrl("https://cdn.example.com/a.jpg", origin)).toBe("https://cdn.example.com/a.jpg");
  });

  it.each([
    ["/event/e1?ref=atletica", `${origin}/event/e1`],
    ["/event/e1?utm_source=ig&utm_medium=story&ref=x", `${origin}/event/e1`],
    ["/event/e1?fbclid=abc&gclid=def", `${origin}/event/e1`],
    ["/event/e1?foo=bar&ref=x", `${origin}/event/e1?foo=bar`],
    ["/event/e1#comprar", `${origin}/event/e1`],
    ["/", `${origin}/`],
    ["https://outro.com/p?ref=1", "https://outro.com/p"],
  ])("cleanCanonicalUrl(%s)", (input, expected) => {
    expect(cleanCanonicalUrl(input, origin)).toBe(expected);
  });
});

describe("buildEventMeta", () => {
  it("enquanto carrega não aplica nada", () => {
    expect(buildEventMeta({ id: "e1", loading: true, event: null })).toEqual({});
  });

  it("evento inexistente: título próprio e noindex", () => {
    expect(buildEventMeta({ id: "x", loading: false, event: null })).toMatchObject({
      title: "Evento não encontrado | EasyTicket",
      noindex: true,
    });
  });

  it("evento carregado: título, descrição com data/local/preço, capa e URL limpa", () => {
    const meta = buildEventMeta({ id: "e1", loading: false, event: baseEvent });
    expect(meta.title).toBe("Festa Universitária — Ingressos | EasyTicket");
    expect(meta.description).toMatch(
      /^Garanta seu ingresso para Festa Universitária em 1 de dezembro de 2026 no Arena Iguaçu, Foz do Iguaçu\. Ingressos a partir de R\$\s50,00\. Compra rápida e segura no EasyTicket\.$/,
    );
    expect(meta.image).toBe("https://cdn.example.com/capa.jpg");
    expect(meta.url).toBe("/event/e1");
    expect(meta.noindex).toBeUndefined();
  });

  it("sem capa própria (imagem de reserva do app), usa o og-image padrão", () => {
    const meta = buildEventMeta({ id: "e1", loading: false, event: { ...baseEvent, image: EVENT_FALLBACK_COVER } });
    expect(meta.image).toMatch(/\/og-image\.png$/);
    expect(buildEventMeta({ id: "e1", loading: false, event: { ...baseEvent, image: "" } }).image).toMatch(/\/og-image\.png$/);
  });

  it("evento gratuito não menciona preço", () => {
    const meta = buildEventMeta({ id: "e1", loading: false, event: { ...baseEvent, price: 0 } });
    expect(meta.description).not.toMatch(/a partir de/);
  });
});
