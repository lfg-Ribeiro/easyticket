import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyTickets from "./MyTickets";

const authState = { user: null as null | { id: string; email: string }, loading: true };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/tickets/TicketDetailModal", () => ({ TicketDetailModal: () => null }));

let resolveQuery: (value: { data: unknown[]; error: null }) => void = () => {};
const query = {
  select: () => query,
  eq: () => query,
  order: () => new Promise((resolve) => { resolveQuery = resolve; }),
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => query } }));

describe("MyTickets – estados de carregamento", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = true;
  });

  it("mostra o skeleton enquanto a sessão carrega, sem piscar 'Nenhum ingresso'", () => {
    render(<MyTickets />);
    expect(screen.getByText("Carregando seus ingressos…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum ingresso")).not.toBeInTheDocument();
  });

  it("mantém o skeleton até a consulta terminar e só então mostra o estado vazio", async () => {
    authState.user = { id: "u1", email: "a@b.com" };
    authState.loading = false;
    render(<MyTickets />);

    expect(screen.getByText("Carregando seus ingressos…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum ingresso")).not.toBeInTheDocument();

    await waitFor(() => expect(typeof resolveQuery).toBe("function"));
    resolveQuery({ data: [], error: null });

    expect(await screen.findByText("Nenhum ingresso")).toBeInTheDocument();
    expect(screen.queryByText("Carregando seus ingressos…")).not.toBeInTheDocument();
  });
});