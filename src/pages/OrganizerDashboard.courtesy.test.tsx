import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockState } from "@/test/supabaseMock";
import OrganizerDashboard from "./OrganizerDashboard";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const auth = vi.hoisted(() => ({
  value: {
    user: { id: "u1", email: "produtor@x.com" },
    session: { access_token: "token" },
    canManageEvents: false,
    canAccessOrganizer: true,
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));

// O servidor calcula as métricas a partir de PEDIDOS confirmados (cortesia não tem pedido)
const SERVER_METRICS = { total_revenue: 700, total_fees: 35, total_tickets: 7, total_checkins: 1, total_events: 1 };

const courtesyRows = (type: "admin" | "organizer", count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${type}-${i}`,
    event_id: "e1",
    batch_id: null,
    order_id: null,
    holder_name: `Cortesia ${type} ${i}`,
    holder_email: `${type}${i}@x.com`,
    guest_name: `Cortesia ${type} ${i}`,
    guest_email: `${type}${i}@x.com`,
    guest_cpf: "52998224725",
    qr_code: `TICKET-${type.toUpperCase()}${i}-1-AAAAAAAA`,
    check_in_status: "valid",
    is_complimentary: true,
    courtesy_type: type,
    created_at: "2026-11-18T10:00:00Z",
  }));

const paidTicket = (id: string, name: string) => ({
  id,
  event_id: "e1",
  batch_id: null,
  order_id: "o1",
  holder_name: name,
  holder_email: `${id}@x.com`,
  guest_name: null,
  guest_email: null,
  guest_cpf: null,
  qr_code: `TICKET-PAID${id}-1-AAAAAAAA`,
  check_in_status: "valid",
  is_complimentary: false,
  courtesy_type: null,
  created_at: "2026-11-17T10:00:00Z",
});

beforeEach(() => {
  auth.value = { ...auth.value, user: { id: "u1", email: "produtor@x.com" } };
  mock.state.queries = [];
  mock.state.ignoreFilters = false;
  mock.state.db = {
    events: [
      {
        id: "e1", organizer_id: "u1", title: "Festa Universitária", event_date: "2026-12-01", event_time: "22:00:00",
        location: "Foz", venue: "Arena", cover_image_url: null, category: "Festa Universitária", published: true,
        deleted_at: null, created_at: "2026-11-01T00:00:00Z",
      },
    ],
    event_organizers: [],
    orders: [
      { id: "o1", event_id: "e1", quantity: 7, subtotal: 700, total_amount: 735, platform_fee: 35, service_fee: 35, payment_status: "confirmed" },
    ],
    ticket_batches: [],
    tickets: [
      paidTicket("pago1", "Comprador Um"),
      paidTicket("pago2", "Comprador Dois"),
      ...courtesyRows("organizer", 3),
      ...courtesyRows("admin", 20), // cortesias fantasma dos donos
    ],
  };
  // O gráfico de vendas (Recharts) usa ResizeObserver, que o jsdom não implementa
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => SERVER_METRICS })),
  );
});

describe("Painel do organizador — cortesias não distorcem vendas nem receita", () => {
  it("'Ingressos Vendidos', receita e vendidos por evento ignoram as 23 cortesias existentes", async () => {
    render(<OrganizerDashboard />);

    const soldLabel = await screen.findByText("Ingressos Vendidos");
    await waitFor(() => expect(soldLabel.closest("div")).toHaveTextContent("7"));
    expect(soldLabel.closest("div")).not.toHaveTextContent("30");
    expect(soldLabel.closest("div")).not.toHaveTextContent("27");

    const grossLabel = screen.getByText("Total Bruto");
    expect(grossLabel.closest("div")).toHaveTextContent(/R\$\s*700,00/);

    // vendidos do evento (calculado a partir dos pedidos): 7 — não 7 + 23 cortesias
    await waitFor(() => expect(screen.getByText("vendidos").closest("span")).toHaveTextContent("7 vendidos"));
  });

  it("nenhum cálculo de vendas lê a tabela de ingressos sem excluir cortesias", async () => {
    render(<OrganizerDashboard />);
    await screen.findByText("Ingressos Vendidos");
    await waitFor(() => expect(mock.state.queries.some((q) => q.table === "tickets")).toBe(true));

    const ticketReads = mock.state.queries.filter((q) => q.table === "tickets" && q.op === "select");
    expect(ticketReads.length).toBeGreaterThan(0);
    for (const query of ticketReads) {
      const excludesAllCourtesies = query.filters.some(([c, v]) => c === "is_complimentary" && v === false);
      const onlyProducerCourtesies = query.filters.some(([c, v]) => c === "courtesy_type" && v === "organizer");
      // ou exclui cortesias (participantes) ou lê SOMENTE cortesias de produtor (aba Cortesias)
      expect(excludesAllCourtesies || onlyProducerCourtesies).toBe(true);
    }
  });

  it("lista de participantes: só compradores — sem cortesias de produtor nem 'admin'", async () => {
    render(<OrganizerDashboard />);
    expect(await screen.findByText("Comprador Um")).toBeInTheDocument();
    expect(screen.getByText("Comprador Dois")).toBeInTheDocument();

    const participants = screen.getByRole("heading", { name: /participantes/i }).closest("div")?.parentElement ?? document.body;
    expect(within(participants).queryByText(/Cortesia admin/)).not.toBeInTheDocument();
    expect(within(participants).queryByText(/Cortesia organizer/)).not.toBeInTheDocument();
  });

  it("aba Cortesias: conta só as 3 cortesias de produtor (nunca as 20 'admin')", async () => {
    render(<OrganizerDashboard />);
    const heading = await screen.findByRole("heading", { name: "Cortesias" });
    const section = heading.closest("section") as HTMLElement;

    await waitFor(() => expect(within(section).getByText(/cortesias emitidas/)).toHaveTextContent("3 cortesias emitidas"));
    expect(within(section).getAllByText(/Cortesia organizer \d/).length).toBeGreaterThan(0);
    expect(within(section).queryByText(/Cortesia admin/)).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: /cortesia master/i })).not.toBeInTheDocument();
  });

  it("dono vê 'Cortesia Master' no painel; produtor não", async () => {
    const { unmount } = render(<OrganizerDashboard />);
    await screen.findByRole("heading", { name: "Cortesias" });
    expect(screen.queryByRole("button", { name: /cortesia master/i })).not.toBeInTheDocument();
    unmount();

    auth.value = { ...auth.value, user: { id: "u1", email: "ZLuan720@gmail.com" } };
    render(<OrganizerDashboard />);
    expect(await screen.findByRole("button", { name: /cortesia master/i })).toBeInTheDocument();
  });
});
