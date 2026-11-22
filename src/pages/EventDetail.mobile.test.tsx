import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockState } from "@/test/supabaseMock";
import EventDetail from "./EventDetail";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ toast }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// O painel desktop não é o foco aqui (e duplicaria textos do drawer)
vi.mock("@/components/checkout/CheckoutPanel", () => ({ CheckoutPanel: () => <div>painel-desktop</div> }));

const eventRow = (batches: Record<string, unknown>[], title = "Festa Universitária") => ({
  id: "e1", title, description: "Descrição do evento", event_date: "2026-12-01", event_time: "22:00:00",
  location: "Foz do Iguaçu", venue: "Arena Iguaçu", cover_image_url: null, category: "Festa Universitária",
  fee_absorbed: false, show_remaining_tickets: false, deleted_at: null, ticket_batches: batches,
});
const batch = (overrides: Record<string, unknown> = {}) => ({
  id: "b1", name: "Lote 1", price: 50, available_quantity: 10, status: "active", is_active: true, sort_order: 0, ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/event/e1"]}>
      <Routes>
        <Route path="/event/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  toast.mockReset();
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  mock.state.db = { events: [eventRow([batch()])] };
});

describe("EventDetail — barra fixa de compra (mobile)", () => {
  it("mostra o lote ativo e o preço formatado", async () => {
    renderPage();
    const bar = await screen.findByRole("region", { name: "Comprar ingresso" });
    expect(bar).toHaveTextContent("Lote 1 • A partir de");
    expect(bar).toHaveTextContent(/R\$\s50,00/);
    expect(bar).toHaveClass("md:hidden", "z-40");
  });

  it("clicar em 'Comprar ingresso' abre o CheckoutDrawer", async () => {
    renderPage();
    const bar = await screen.findByRole("region", { name: "Comprar ingresso" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(within(bar).getByRole("button", { name: "Comprar ingresso" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Finalizar Compra")).toBeInTheDocument();
    // a barra (z-40) fica abaixo do drawer (z-50)
    expect(bar.className).toMatch(/\bz-40\b/);
  });

  it("esgotado: mostra o CTA 'Esgotado' desabilitado e o clique não abre o checkout", async () => {
    mock.state.db = { events: [eventRow([batch({ available_quantity: 0 })])] };
    renderPage();

    const bar = await screen.findByRole("region", { name: "Comprar ingresso" });
    const cta = within(bar).getByRole("button", { name: "Esgotado" });
    expect(cta).toBeDisabled();
    expect(within(bar).getByText("Ingressos esgotados")).toBeInTheDocument();
    fireEvent.click(cta);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("evento sem nenhum lote com estoque também aparece como esgotado", async () => {
    mock.state.db = { events: [eventRow([batch({ available_quantity: 0 }), batch({ id: "b2", name: "Lote 2", available_quantity: 0, is_active: false })])] };
    renderPage();
    const bar = await screen.findByRole("region", { name: "Comprar ingresso" });
    expect(within(bar).getByRole("button", { name: "Esgotado" })).toBeDisabled();
  });

  it("o conteúdo tem folga embaixo (pb-36) para a barra não cobrir descrição e local", async () => {
    const { container } = renderPage();
    await screen.findByRole("region", { name: "Comprar ingresso" });
    const content = container.querySelector(".container.relative");
    expect(content).toHaveClass("pb-36", "md:pb-10");
  });

  it("título longo e local quebram em vez de estourar a tela", async () => {
    mock.state.db = { events: [eventRow([batch()], "FESTIVALUNIVERSITARIOMEGALONGOSEMESPACOS".repeat(3))] };
    renderPage();
    await screen.findByRole("region", { name: "Comprar ingresso" });
    screen.getAllByRole("heading", { level: 1 }).forEach((h1) => expect(h1).toHaveClass("break-words"));
    screen.getAllByText(/Arena Iguaçu, Foz do Iguaçu/).forEach((el) => expect(el).toHaveClass("break-words", "min-w-0"));
  });

  it("botões Voltar e Compartilhar têm 44px no celular, nome acessível e o compartilhar copia o link", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    renderPage();
    const back = await screen.findByRole("button", { name: "Voltar" });
    const share = screen.getByRole("button", { name: "Compartilhar evento" });
    [back, share].forEach((button) => expect(button).toHaveClass("w-11", "h-11", "md:w-10", "md:h-10"));

    fireEvent.click(share);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link do evento copiado!" }));
  });
});
