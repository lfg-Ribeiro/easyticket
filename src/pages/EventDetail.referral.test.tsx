import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredReferral } from "@/lib/referral";
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
vi.mock("@/components/checkout/CheckoutPanel", () => ({ CheckoutPanel: () => <div>painel</div> }));
vi.mock("@/components/checkout/CheckoutDrawer", () => ({ CheckoutDrawer: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/event/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  mock.state.db = {
    events: [
      {
        id: "e1", title: "Festa Universitária", description: "", event_date: "2026-12-01", event_time: "22:00:00",
        location: "Foz", venue: "Arena", cover_image_url: null, category: "Festa Universitária",
        fee_absorbed: false, show_remaining_tickets: false, deleted_at: null,
        ticket_batches: [{ id: "b1", name: "Lote 1", price: 50, available_quantity: 10, status: "active", is_active: true, sort_order: 0 }],
      },
    ],
  };
});

describe("Página pública do evento — captura de ?ref=", () => {
  it("guarda ?ref= normalizado para o evento ao abrir o link da atlética", async () => {
    renderAt("/event/e1?ref=Atlética%20Engenharia");
    expect((await screen.findAllByText("Festa Universitária")).length).toBeGreaterThan(0);
    expect(getStoredReferral("e1")).toBe("atletica_engenharia");
  });

  it("aceita ?utm_source= quando não há ?ref=", async () => {
    renderAt("/event/e1?utm_source=Instagram");
    await screen.findAllByText("Festa Universitária");
    expect(getStoredReferral("e1")).toBe("instagram");
  });

  it("sem parâmetros, não guarda nada", async () => {
    renderAt("/event/e1");
    await screen.findAllByText("Festa Universitária");
    expect(getStoredReferral("e1")).toBeNull();
  });
});
