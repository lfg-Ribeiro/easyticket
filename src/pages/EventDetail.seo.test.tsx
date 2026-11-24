import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, canonicalHref, meta, metaContent, resetHead } from "@/test/seoHead";
import { createMockState } from "@/test/supabaseMock";
import EventDetail from "./EventDetail";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/checkout/CheckoutPanel", () => ({ CheckoutPanel: () => null }));
vi.mock("@/components/checkout/CheckoutDrawer", () => ({ CheckoutDrawer: () => null }));

const origin = window.location.origin;
const COVER = "https://cdn.example.com/eventos/festa.jpg";

const eventRow = (overrides: Record<string, unknown> = {}) => ({
  id: "e1", title: "Festa Universitária", description: "Descrição", event_date: "2026-12-01", event_time: "22:00:00",
  location: "Foz do Iguaçu", venue: "Arena Iguaçu", cover_image_url: COVER, category: "Festa Universitária",
  fee_absorbed: false, show_remaining_tickets: false, deleted_at: null,
  ticket_batches: [{ id: "b1", name: "Lote 1", price: 50, available_quantity: 10, status: "active", is_active: true, sort_order: 0 }],
  ...overrides,
});

/** Espera o evento carregar E o efeito do usePageMeta rodar (efeitos passivos rodam depois do commit). */
const metaApplied = async () => {
  await screen.findAllByText("Festa Universitária");
  await waitFor(() => expect(document.title).not.toBe(DEFAULT_TITLE));
};

const renderAt = (url: string) => {
  window.history.pushState({}, "", url);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/event/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  resetHead();
  localStorage.clear();
  mock.state.db = { events: [eventRow()] };
});

describe("EventDetail — SEO e Open Graph", () => {
  it("título, descrição e og:image do evento carregado (data, local, preço e capa)", async () => {
    renderAt("/event/e1");
    await metaApplied();

    expect(document.title).toBe("Festa Universitária — Ingressos | EasyTicket");
    const description = metaContent('meta[name="description"]')!;
    expect(description).toContain("Garanta seu ingresso para Festa Universitária");
    expect(description).toContain("1 de dezembro de 2026");
    expect(description).toContain("Arena Iguaçu, Foz do Iguaçu");
    expect(description).toMatch(/a partir de R\$\s50,00/);
    expect(description).toContain("Compra rápida e segura no EasyTicket.");

    expect(metaContent('meta[property="og:title"]')).toBe("Festa Universitária — Ingressos | EasyTicket");
    expect(metaContent('meta[property="og:description"]')).toBe(description);
    expect(metaContent('meta[property="og:image"]')).toBe(COVER);
    expect(metaContent('meta[name="twitter:image"]')).toBe(COVER);
    expect(metaContent('meta[name="twitter:title"]')).toBe("Festa Universitária — Ingressos | EasyTicket");
    // a capa do evento não tem as dimensões 1200x630 declaradas no padrão
    expect(meta('meta[property="og:image:width"]')).toBeNull();
    expect(meta('meta[name="robots"]')).toBeNull(); // evento público: indexável
  });

  it("canonical e og:url são o caminho limpo do evento, sem ?ref=", async () => {
    renderAt("/event/e1?ref=atletica_engenharia&utm_source=instagram");
    await metaApplied();
    expect(canonicalHref()).toBe(`${origin}/event/e1`);
    expect(metaContent('meta[property="og:url"]')).toBe(`${origin}/event/e1`);
  });

  it("sem capa própria, a imagem de compartilhamento é o og-image padrão do site", async () => {
    mock.state.db = { events: [eventRow({ cover_image_url: null })] };
    renderAt("/event/e1");
    await metaApplied();
    expect(metaContent('meta[property="og:image"]')).toBe(`${origin}/og-image.png`);
    expect(metaContent('meta[name="twitter:image"]')).toBe(`${origin}/og-image.png`);
    expect(metaContent('meta[property="og:image:width"]')).toBe("1200"); // imagem padrão mantém as dimensões
  });

  it("evento inexistente: título próprio e noindex", async () => {
    mock.state.db = { events: [] };
    renderAt("/event/nao-existe");
    await screen.findByText(/Evento não encontrado/i, { selector: "h1, h2, p" }).catch(() => null);
    await vi.waitFor(() => expect(document.title).toBe("Evento não encontrado | EasyTicket"));
    expect(metaContent('meta[name="robots"]')).toBe("noindex, nofollow");
  });

  it("enquanto carrega mantém o título padrão; ao sair da página, volta ao padrão", async () => {
    const { unmount } = renderAt("/event/e1");
    expect(document.title).toBe(DEFAULT_TITLE);
    await metaApplied();

    unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(metaContent('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION);
    expect(canonicalHref()).toBeNull();
  });
});
