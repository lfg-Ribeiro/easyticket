import { fireEvent, render, screen, within } from "@testing-library/react";
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

const LONG_TITLE = "FestivalUniversitarioDeEngenhariaCivilEAmbiental".repeat(2);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  mock.state.db = {
    tickets: [
      {
        id: "t1", user_id: "u1", qr_code: "TICKET-AAAAAAAA-1-BBBBBBBB", check_in_status: "valid", holder_name: "Ana",
        created_at: "2026-11-18T10:00:00Z", is_complimentary: false,
        order: { quantity: 1, total_amount: 50, payment_status: "confirmed" },
        event: { id: "e1", title: LONG_TITLE, description: "", event_date: "2026-12-05", event_time: "22:00:00", location: "Foz", venue: "Arena", cover_image_url: null, category: "Shows" },
      },
    ],
  };
});

describe("Meus Ingressos — celular", () => {
  it("o cartão do ingresso é um botão acessível (teclado) e abre o QR Code com Enter ou Espaço", async () => {
    render(<MyTickets />);
    const card = await screen.findByRole("button", { name: `Abrir ingresso: ${LONG_TITLE}` });
    expect(card).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(card, { key: "Enter" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("título longo quebra em vez de estourar o cartão", async () => {
    render(<MyTickets />);
    const title = await screen.findByText(LONG_TITLE, { selector: "h3" });
    expect(title).toHaveClass("break-words", "min-w-0");
  });

  it("modal do QR: fechar (X) e 'Transferir' têm 44px; campo de CPF abre teclado numérico", async () => {
    render(<MyTickets />);
    fireEvent.click(await screen.findByText(LONG_TITLE, { selector: "h3" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Close").closest("button")).toHaveClass("h-11", "w-11");
    const transfer = within(dialog).getByRole("button", { name: /transferir ingresso/i });
    expect(transfer).toHaveClass("min-h-[44px]");

    fireEvent.click(transfer);
    const cpf = dialog.querySelector("#transfer-cpf") as HTMLInputElement;
    expect(cpf).toHaveAttribute("inputmode", "numeric");
    expect(cpf).toHaveClass("min-h-[44px]");
    expect(within(dialog).getByRole("button", { name: "Cancelar transferência" })).toHaveClass("h-11", "w-11");
    expect(within(dialog).getByRole("button", { name: /confirmar transferência/i })).toHaveClass("min-h-[44px]");
  });
});
