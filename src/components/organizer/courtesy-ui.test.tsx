import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockState, createSupabaseMock } from "@/test/supabaseMock";
import { CourtesyList } from "./CourtesyList";
import { CourtesySection } from "./CourtesySection";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ toast }));

const auth = vi.hoisted(() => ({ value: { user: null as { email: string } | null, canAccessOrganizer: false } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));

// Radix Select depende de APIs de ponteiro que o jsdom não tem; um stand-in simples basta aqui.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const Ctx = React.createContext<(value: string) => void>(() => {});
  return {
    Select: ({ onValueChange, children }: { onValueChange: (v: string) => void; children: React.ReactNode }) => (
      <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button type="button" {...props}>{children}</button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const onValueChange = React.useContext(Ctx);
      return <button type="button" onClick={() => onValueChange(value)}>{children}</button>;
    },
  };
});

const EVENTS = [
  { id: "e1", title: "Festa A", event_date: "2026-12-01" },
  { id: "e2", title: "Festa B", event_date: "2026-12-02" },
];
const OWNERS = ["lribeiro@easyticket.com", "ZLuan720@Gmail.com"];
const VALID_CPF = "529.982.247-25";
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
const change = (id: string, value: string) => fireEvent.change(byId(id), { target: { value } });

const row = (overrides: Record<string, unknown>) => ({
  id: "t",
  event_id: "e1",
  qr_code: "TICKET-AAAAAAAA-1-BBBBBBBB",
  guest_name: "Ana Souza",
  guest_email: "ana@x.com",
  guest_cpf: "52998224725",
  check_in_status: "valid",
  courtesy_type: "organizer",
  is_complimentary: true,
  created_at: "2026-11-18T10:00:00Z",
  ...overrides,
});

beforeEach(() => {
  mock.state.db = {};
  mock.state.queries = [];
  mock.state.ignoreFilters = false;
  (mock.state.rpc as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ data: null, error: null });
  toast.mockReset();
  auth.value = { user: { email: "produtor@x.com" }, canAccessOrganizer: true };
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});

describe("Cortesia Master — visível somente para os donos da plataforma", () => {
  it.each(OWNERS)("dono %s vê 'Cortesia Master' e 'Emitir Cortesia'", (email) => {
    auth.value = { user: { email }, canAccessOrganizer: true };
    render(<CourtesySection events={EVENTS} />);
    expect(screen.getByRole("button", { name: /cortesia master/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /emitir cortesia/i })).toBeInTheDocument();
  });

  it("dono sem papéis (zluan720) também vê, mesmo sem canAccessOrganizer", () => {
    auth.value = { user: { email: "zluan720@gmail.com" }, canAccessOrganizer: false };
    render(<CourtesySection events={[]} />);
    expect(screen.getByRole("button", { name: /cortesia master/i })).toBeInTheDocument();
  });

  it("produtor comum vê 'Emitir Cortesia', mas NÃO 'Cortesia Master'", () => {
    auth.value = { user: { email: "produtor@x.com" }, canAccessOrganizer: true };
    render(<CourtesySection events={EVENTS} />);
    expect(screen.getByRole("button", { name: /emitir cortesia/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cortesia master/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/cortesia master/i)).not.toBeInTheDocument();
  });

  it("admin comum (não dono) NÃO vê 'Cortesia Master'", () => {
    auth.value = { user: { email: "admin@easyticket.com" }, canAccessOrganizer: true };
    render(<CourtesySection events={EVENTS} />);
    expect(screen.queryByRole("button", { name: /cortesia master/i })).not.toBeInTheDocument();
  });

  it("usuário comum não vê nenhuma seção de cortesias", () => {
    auth.value = { user: { email: "comprador@x.com" }, canAccessOrganizer: false };
    const { container } = render(<CourtesySection events={EVENTS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("o modal Master lista TODOS os eventos (via RPC) e emite pela RPC de admin, com CPF só em dígitos", async () => {
    auth.value = { user: { email: "lribeiro@easyticket.com" }, canAccessOrganizer: true };
    (mock.state.rpc as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) => {
      if (name === "list_admin_courtesy_events") {
        return { data: [{ id: "e9", title: "Evento Não Publicado", event_date: "2026-12-09", published: false }], error: null };
      }
      return { data: { issued: 2, user_linked: false, qr_codes: ["TICKET-11111111-1-AAAAAAAA", "TICKET-11111111-2-BBBBBBBB"] }, error: null };
    });
    render(<CourtesySection events={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /cortesia master/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /cortesia master/i })).toBeInTheDocument();
    fireEvent.click(await within(dialog).findByRole("button", { name: /Evento Não Publicado/ }));
    change("courtesy-name", "Maria Convidada");
    change("courtesy-email", "Maria@Email.com");
    change("courtesy-cpf", "52998224725");
    change("courtesy-quantity", "2");
    fireEvent.click(within(dialog).getByRole("button", { name: /emitir cortesia/i }));

    await waitFor(() => expect(within(dialog).getByText(/2 cortesias emitidas para Maria Convidada/)).toBeInTheDocument());
    expect(mock.state.rpc).toHaveBeenCalledWith("issue_admin_courtesy", {
      p_event_id: "e9",
      p_guest_name: "Maria Convidada",
      p_guest_email: "maria@email.com",
      p_guest_cpf: "52998224725",
      p_quantity: 2,
    });
    expect(within(dialog).getByText(/assim que o convidado criar a conta/i)).toBeInTheDocument();
    expect(within(dialog).getByText("TICKET-11111111-1-AAAAAAAA")).toBeInTheDocument();
  });
});

describe("Emitir Cortesia (produtor) — validação inline", () => {
  const openProducerModal = (events = EVENTS) => {
    auth.value = { user: { email: "produtor@x.com" }, canAccessOrganizer: true };
    render(<CourtesySection events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /emitir cortesia/i }));
    return screen.findByRole("dialog");
  };

  it("campos vazios: erro em cada campo, borda vermelha, foco no primeiro e nenhuma chamada ao servidor", async () => {
    const dialog = await openProducerModal();
    fireEvent.click(within(dialog).getByRole("button", { name: /^emitir cortesia$/i }));

    expect(within(dialog).getByText("Escolha o evento da cortesia")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe seu nome completo")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe seu e-mail")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe seu CPF")).toBeInTheDocument();
    expect(byId("courtesy-name")).toHaveClass("border-destructive");
    expect(byId("courtesy-name")).toHaveAttribute("aria-invalid", "true");
    expect(mock.state.rpc).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(byId("courtesy-event")));
  });

  it("CPF inválido, e-mail inválido e quantidade fora do limite", async () => {
    const dialog = await openProducerModal();
    fireEvent.click(within(dialog).getByRole("button", { name: /Festa A/ }));
    change("courtesy-name", "Ana Souza");
    change("courtesy-email", "ana@email");
    change("courtesy-cpf", "11111111111");
    change("courtesy-quantity", "21");
    fireEvent.click(within(dialog).getByRole("button", { name: /^emitir cortesia$/i }));

    expect(within(dialog).getByText("CPF inválido. Confira os números digitados")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe um e-mail válido, como nome@email.com")).toBeInTheDocument();
    expect(within(dialog).getByText("A quantidade máxima é 20")).toBeInTheDocument();
    expect(mock.state.rpc).not.toHaveBeenCalled();

    // corrigir um campo remove só o erro dele, e mantém a máscara
    change("courtesy-cpf", "52998224725");
    expect(byId("courtesy-cpf")).toHaveValue(VALID_CPF);
    expect(within(dialog).queryByText(/CPF inválido/)).not.toBeInTheDocument();
    expect(within(dialog).getByText("A quantidade máxima é 20")).toBeInTheDocument();
  });

  it("com um único evento, ele já vem selecionado; emite pela RPC de PRODUTOR (nunca a de admin)", async () => {
    (mock.state.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { issued: 1, user_linked: true, qr_codes: ["TICKET-22222222-1-CCCCCCCC"] }, error: null });
    const dialog = await openProducerModal([EVENTS[0]]);
    change("courtesy-name", "Ana Souza");
    change("courtesy-email", "ana@email.com");
    change("courtesy-cpf", VALID_CPF);
    fireEvent.click(within(dialog).getByRole("button", { name: /^emitir cortesia$/i }));

    await waitFor(() => expect(within(dialog).getByText(/1 cortesia emitida para Ana Souza/)).toBeInTheDocument());
    expect(within(dialog).getByText(/já aparece em Meus Ingressos/i)).toBeInTheDocument();
    const names = (mock.state.rpc as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);
    expect(names).toEqual(["issue_organizer_courtesy"]);
    expect(names).not.toContain("issue_admin_courtesy");
  });

  it("erro do servidor em campo (CPF) aparece inline; permissão negada vira toast", async () => {
    const rpc = mock.state.rpc as ReturnType<typeof vi.fn>;
    const dialog = await openProducerModal([EVENTS[0]]);
    change("courtesy-name", "Ana Souza");
    change("courtesy-email", "ana@email.com");
    change("courtesy-cpf", VALID_CPF);

    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "CPF do convidado inválido" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^emitir cortesia$/i }));
    expect(await within(dialog).findByText("CPF inválido. Confira os números digitados")).toBeInTheDocument();

    change("courtesy-cpf", "39053344705");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Não autorizado" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^emitir cortesia$/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Erro ao emitir cortesia", variant: "destructive" })),
    );
  });
});

describe("Aba Cortesias do produtor — nunca mostra cortesias 'admin'", () => {
  const seed = () => {
    mock.state.db.tickets = [
      row({ id: "org-valid", guest_name: "Ana Valida", qr_code: "TICKET-ORGVALID-1-AAAAAAAA" }),
      row({ id: "org-used", guest_name: "Bruno Usado", check_in_status: "used", qr_code: "TICKET-ORGUSED0-1-AAAAAAAA" }),
      row({ id: "ghost-1", guest_name: "Fantasma Um", courtesy_type: "admin", qr_code: "TICKET-GHOST001-1-AAAAAAAA", guest_email: "lribeiro@easyticket.com" }),
      row({ id: "ghost-2", guest_name: "Fantasma Dois", courtesy_type: "admin", qr_code: "TICKET-GHOST002-1-AAAAAAAA", guest_email: "zluan720@gmail.com" }),
      row({ id: "paid", guest_name: "Pagante", is_complimentary: false, courtesy_type: null }),
    ];
  };

  it("consulta só 'organizer' e mostra nome, e-mail, CPF e status Válida/Utilizada", async () => {
    seed();
    render(<CourtesyList events={EVENTS} />);

    expect(await screen.findByText("Ana Valida")).toBeInTheDocument();
    expect(screen.getByText("Bruno Usado")).toBeInTheDocument();
    expect(screen.queryByText(/Fantasma/)).not.toBeInTheDocument();
    expect(screen.queryByText("Pagante")).not.toBeInTheDocument();
    expect(screen.getAllByText("ana@x.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("52998224725").length).toBeGreaterThan(0);
    expect(screen.getByText("Válida")).toBeInTheDocument();
    expect(screen.getByText("Utilizada")).toBeInTheDocument();
    expect(screen.getByText(/cortesias emitidas/)).toHaveTextContent("2 cortesias emitidas");

    const query = mock.state.queries.find((q) => q.table === "tickets");
    expect(query?.filters).toContainEqual(["courtesy_type", "organizer"]);
  });

  it("segunda barreira: mesmo que a consulta vazasse linhas 'admin', elas não aparecem nem entram no contador", async () => {
    seed();
    mock.state.ignoreFilters = true; // simula RLS/consulta vazando tudo
    render(<CourtesyList events={EVENTS} />);

    expect(await screen.findByText("Ana Valida")).toBeInTheDocument();
    expect(screen.queryByText(/Fantasma/)).not.toBeInTheDocument();
    expect(screen.queryByText("TICKET-GHOST001-1-AAAAAAAA")).not.toBeInTheDocument();
    expect(screen.getByText(/cortesias emitidas/)).toHaveTextContent("2 cortesias emitidas");
  });

  it("estado vazio quando só existem cortesias 'admin'", async () => {
    mock.state.db.tickets = [row({ id: "ghost-1", courtesy_type: "admin", guest_name: "Fantasma Um" })];
    mock.state.ignoreFilters = true;
    render(<CourtesyList events={EVENTS} />);
    expect(await screen.findByText("Nenhuma cortesia emitida ainda")).toBeInTheDocument();
    expect(screen.getByText(/cortesias emitidas/)).toHaveTextContent("0 cortesias emitidas");
  });

  it("copiar código, e revogar só aparece para cortesias não utilizadas", async () => {
    seed();
    render(<CourtesyList events={EVENTS} />);
    await screen.findByText("Ana Valida");

    fireEvent.click(screen.getByRole("button", { name: "Copiar código de Ana Valida" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("TICKET-ORGVALID-1-AAAAAAAA"));

    expect(screen.getByRole("button", { name: "Revogar cortesia de Ana Valida" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar cortesia de Bruno Usado" })).not.toBeInTheDocument();
  });

  it("revogar pede confirmação, exclui só a cortesia 'organizer' e atualiza a lista", async () => {
    seed();
    render(<CourtesyList events={EVENTS} />);
    await screen.findByText("Ana Valida");

    fireEvent.click(screen.getByRole("button", { name: "Revogar cortesia de Ana Valida" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/QR Code deixará de funcionar/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: "Revogar" }));

    await waitFor(() => expect(screen.queryByText("Ana Valida")).not.toBeInTheDocument());
    const del = mock.state.queries.find((q) => q.op === "delete");
    expect(del?.filters).toEqual(expect.arrayContaining([["id", "org-valid"], ["courtesy_type", "organizer"]]));
    expect(mock.state.db.tickets.find((t) => t.id === "ghost-1")).toBeDefined(); // cortesia admin intacta
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Cortesia revogada" }));
  });

  it("filtra por evento", async () => {
    mock.state.db.tickets = [
      row({ id: "a", guest_name: "Ana Evento A", event_id: "e1" }),
      row({ id: "b", guest_name: "Beto Evento B", event_id: "e2", qr_code: "TICKET-BBBBBBBB-1-AAAAAAAA" }),
    ];
    render(<CourtesyList events={EVENTS} />);
    await screen.findByText("Ana Evento A");
    fireEvent.change(screen.getByLabelText("Filtrar cortesias por evento"), { target: { value: "e2" } });
    expect(screen.queryByText("Ana Evento A")).not.toBeInTheDocument();
    expect(screen.getByText("Beto Evento B")).toBeInTheDocument();
  });
});
