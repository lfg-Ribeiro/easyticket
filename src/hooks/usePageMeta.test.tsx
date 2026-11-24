import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, DEFAULT_TITLE, canonicalHref, meta, metaContent, resetHead } from "@/test/seoHead";
import { usePageMeta, type PageMeta } from "./usePageMeta";

const origin = window.location.origin;

beforeEach(() => {
  resetHead();
  window.history.pushState({}, "", "/");
});

describe("usePageMeta", () => {
  it("atualiza título, descrição, Open Graph e Twitter Card", () => {
    renderHook(() =>
      usePageMeta({
        title: "Meus Ingressos | EasyTicket",
        description: "Acesse seus ingressos digitais.",
        image: "https://cdn.example.com/capa.jpg",
      }),
    );

    expect(document.title).toBe("Meus Ingressos | EasyTicket");
    expect(metaContent('meta[name="description"]')).toBe("Acesse seus ingressos digitais.");
    expect(metaContent('meta[property="og:title"]')).toBe("Meus Ingressos | EasyTicket");
    expect(metaContent('meta[property="og:description"]')).toBe("Acesse seus ingressos digitais.");
    expect(metaContent('meta[property="og:image"]')).toBe("https://cdn.example.com/capa.jpg");
    expect(metaContent('meta[property="og:type"]')).toBe("website");
    expect(metaContent('meta[property="og:site_name"]')).toBe("EasyTicket");
    expect(metaContent('meta[property="og:locale"]')).toBe("pt_BR");
    expect(metaContent('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(metaContent('meta[name="twitter:title"]')).toBe("Meus Ingressos | EasyTicket");
    expect(metaContent('meta[name="twitter:description"]')).toBe("Acesse seus ingressos digitais.");
    expect(metaContent('meta[name="twitter:image"]')).toBe("https://cdn.example.com/capa.jpg");
  });

  it("canonical: caminho limpo, sem ?ref= e sem parâmetros de rastreamento (e og:url igual)", () => {
    window.history.pushState({}, "", "/event/e1?ref=atletica_engenharia&utm_source=ig&utm_campaign=x&fbclid=abc&foo=bar#topo");
    renderHook(() => usePageMeta({ title: "Evento | EasyTicket", description: "d" }));
    expect(canonicalHref()).toBe(`${origin}/event/e1?foo=bar`);
    expect(metaContent('meta[property="og:url"]')).toBe(`${origin}/event/e1?foo=bar`);
  });

  it("canonical sem nenhum parâmetro quando só há rastreamento; url explícita também é limpa", () => {
    window.history.pushState({}, "", "/event/e1?ref=abc");
    const { unmount } = renderHook(() => usePageMeta({ title: "t", description: "d" }));
    expect(canonicalHref()).toBe(`${origin}/event/e1`);
    unmount();

    renderHook(() => usePageMeta({ title: "t", url: "/event/e2?ref=xyz&utm_source=a" }));
    expect(canonicalHref()).toBe(`${origin}/event/e2`);
  });

  it("noindex: adiciona robots 'noindex, nofollow' e remove ao desmontar", () => {
    const { unmount } = renderHook(() => usePageMeta({ title: "Painel do Organizador | EasyTicket", noindex: true }));
    expect(metaContent('meta[name="robots"]')).toBe("noindex, nofollow");
    unmount();
    expect(meta('meta[name="robots"]')).toBeNull();
  });

  it("sem noindex, não cria a tag robots (a página fica indexável)", () => {
    renderHook(() => usePageMeta({ title: "Entrar ou Criar Conta | EasyTicket", description: "d" }));
    expect(meta('meta[name="robots"]')).toBeNull();
  });

  it("ao desmontar, restaura os padrões do index.html e remove o que foi criado", () => {
    const { unmount } = renderHook(() =>
      usePageMeta({ title: "Outra | EasyTicket", description: "outra", image: "/capa.png", noindex: true }),
    );
    expect(document.title).toBe("Outra | EasyTicket");
    unmount();

    expect(document.title).toBe(DEFAULT_TITLE);
    expect(metaContent('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION);
    expect(metaContent('meta[property="og:title"]')).toBe(DEFAULT_TITLE);
    expect(metaContent('meta[property="og:image"]')).toBe(DEFAULT_OG_IMAGE);
    expect(metaContent('meta[name="twitter:image"]')).toBe(DEFAULT_OG_IMAGE);
    expect(metaContent('meta[property="og:image:width"]')).toBe("1200");
    expect(metaContent('meta[property="og:image:height"]')).toBe("630");
    expect(canonicalHref()).toBeNull();
    expect(meta('meta[name="robots"]')).toBeNull();
    expect(document.head.querySelectorAll("[data-page-meta]")).toHaveLength(0);
  });

  it("atualiza quando os dados mudam (ex.: o evento termina de carregar) e restaura no fim", () => {
    const { rerender, unmount } = renderHook(({ m }: { m: PageMeta }) => usePageMeta(m), {
      initialProps: { m: {} as PageMeta },
    });
    expect(document.title).toBe(DEFAULT_TITLE); // {} não aplica nada

    rerender({ m: { title: "Festa — Ingressos | EasyTicket", description: "Descrição da festa" } });
    expect(document.title).toBe("Festa — Ingressos | EasyTicket");
    expect(metaContent('meta[name="description"]')).toBe("Descrição da festa");

    rerender({ m: { title: "Show — Ingressos | EasyTicket", description: "Descrição do show" } });
    expect(document.title).toBe("Show — Ingressos | EasyTicket");
    expect(metaContent('meta[property="og:title"]')).toBe("Show — Ingressos | EasyTicket");

    unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(metaContent('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION);
  });

  it("noindex pode ser desligado numa atualização", () => {
    const { rerender } = renderHook(({ m }: { m: PageMeta }) => usePageMeta(m), {
      initialProps: { m: { title: "x", noindex: true } as PageMeta },
    });
    expect(meta('meta[name="robots"]')).not.toBeNull();
    rerender({ m: { title: "x", noindex: false } });
    expect(meta('meta[name="robots"]')).toBeNull();
  });

  it("imagem relativa vira URL absoluta", () => {
    renderHook(() => usePageMeta({ title: "t", image: "/capa.png" }));
    expect(metaContent('meta[property="og:image"]')).toBe(`${origin}/capa.png`);
  });

  it("imagem diferente da padrão remove og:image:width/height; a padrão mantém", () => {
    const custom = renderHook(() => usePageMeta({ title: "t", image: "https://cdn.example.com/capa.jpg" }));
    expect(meta('meta[property="og:image:width"]')).toBeNull();
    expect(meta('meta[property="og:image:height"]')).toBeNull();
    custom.unmount();
    expect(metaContent('meta[property="og:image:width"]')).toBe("1200");

    renderHook(() => usePageMeta({ title: "t", image: "/og-image.png" }));
    expect(metaContent('meta[property="og:image:width"]')).toBe("1200");
    expect(metaContent('meta[property="og:image:height"]')).toBe("630");
  });

  it("tipo de og:type customizável", () => {
    renderHook(() => usePageMeta({ title: "t", type: "article" }));
    expect(metaContent('meta[property="og:type"]')).toBe("article");
  });

  it("navegar de uma página para outra: a segunda vale, e ao sair tudo volta ao padrão", () => {
    const a = renderHook(() => usePageMeta({ title: "A | EasyTicket", description: "a", noindex: true }));
    a.unmount();
    const b = renderHook(() => usePageMeta({ title: "B | EasyTicket", description: "b" }));
    expect(document.title).toBe("B | EasyTicket");
    expect(meta('meta[name="robots"]')).toBeNull(); // o noindex da página A não "vaza"
    b.unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
  });

  it("funciona em StrictMode (efeito executado duas vezes) sem sobras no <head>", () => {
    const { unmount } = renderHook(() => usePageMeta({ title: "S | EasyTicket", description: "s", noindex: true }), {
      wrapper: StrictMode,
    });
    expect(document.title).toBe("S | EasyTicket");
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(document.head.querySelectorAll("[data-page-meta]")).toHaveLength(0);
  });
});
