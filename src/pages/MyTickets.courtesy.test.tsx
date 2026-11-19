import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockState } from "@/test/supabaseMock";
import MyTickets from "./MyTickets";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
// referência estável: MyTickets refaz a busca quando o objeto `user` muda
const authValue = vi.hoisted(() => ({ user: { id: "u1", email: "convidado@x.com" }, loading: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authValue }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const event = (title: string) => ({
  id: `ev-${title}`,
  title,
  description: "",
  event_date: "2026-12-05",
  event_time: "22:00:00",
  location: "Foz do Iguaçu",
  venue: "Arena",
  cover_image_url: null,
  category: "Shows",
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  mock.state.queries = [];
  mock.state.db = {
    tickets: [
      {
        // cortesia: SEM pedido (order_id nulo) — precisa aparecer normalmente
        id: "t-courtesy", user_id: "u1", qr_code: "TICKET-COURTESY-1-AAAAAAAA", check_in_status: "valid",
        holder_name: "Convidado", created_at: "2026-11-18T10:00:00Z", is_complimentary: true,
        order: null, event: event("Festa da Cortesia"),
      },
      {
        id: "t-paid", user_id: "u1", qr_code: "TICKET-PAID0001-1-AAAAAAAA", check_in_status: "valid",
        holder_name: "Convidado", created_at: "2026-11-17T10:00:00Z", is_complimentary: false,
        order: { quantity: 2, total_amount: 105, payment_status: "confirmed" }, event: event("Show Pago"),
      },
      {
        // pedido pendente continua escondido
        id: "t-pending", user_id: "u1", qr_code: "TICKET-PENDING1-1-AAAAAAAA", check_in_status: "valid",
        holder_name: "Convidado", created_at: "2026-11-16T10:00:00Z", is_complimentary: false,
        order: { quantity: 1, total_amount: 50, payment_status: "pending" }, event: event("Evento Pendente"),
      },
      { id: "t-other", user_id: "outro", qr_code: "TICKET-OTHER001-1-AAAAAAAA", check_in_status: "valid", holder_name: "Outro", created_at: "2026-11-15T10:00:00Z", is_complimentary: true, order: null, event: event("De Outro Usuário") },
    ],
  };
});

describe("Meus Ingressos — cortesias", () => {
  it("mostra a cortesia sem pedido com o selo 'Cortesia'; ingresso pago não tem o selo", async () => {
    render(<MyTickets />);

    const courtesyCard = (await screen.findByText("Festa da Cortesia")).closest("article") as HTMLElement;
    expect(within(courtesyCard).getByText("Cortesia")).toBeInTheDocument();
    expect(within(courtesyCard).getByText("Disponível")).toBeInTheDocument();
    expect(within(courtesyCard).getByText("1 ingresso")).toBeInTheDocument();

    const paidCard = screen.getByText("Show Pago").closest("article") as HTMLElement;
    expect(within(paidCard).queryByText("Cortesia")).not.toBeInTheDocument();
    expect(within(paidCard).getByText("2 ingressos")).toBeInTheDocument();
  });

  it("continua escondendo pedidos pendentes e ingressos de outros usuários", async () => {
    render(<MyTickets />);
    await screen.findByText("Festa da Cortesia");
    expect(screen.queryByText("Evento Pendente")).not.toBeInTheDocument();
    expect(screen.queryByText("De Outro Usuário")).not.toBeInTheDocument();
  });

  it("a consulta pede is_complimentary e filtra por user_id", async () => {
    render(<MyTickets />);
    await screen.findByText("Festa da Cortesia");
    const query = mock.state.queries.find((q) => q.table === "tickets");
    expect(query?.columns).toContain("is_complimentary");
    expect(query?.filters).toContainEqual(["user_id", "u1"]);
  });

  it("o detalhe da cortesia mostra o selo e o QR Code padrão, mesmo sem pedido", async () => {
    render(<MyTickets />);
    fireEvent.click(await screen.findByText("Festa da Cortesia"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Cortesia")).toBeInTheDocument();
    await waitFor(() => expect(dialog.querySelector("svg[viewBox]")).not.toBeNull());
    expect(within(dialog).getByText("Disponível")).toBeInTheDocument();
  });
});
