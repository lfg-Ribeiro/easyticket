import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockState } from "@/test/supabaseMock";
import { AffiliatesSection } from "./AffiliatesSection";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ toast }));

const EVENTS = [
  { id: "e1", title: "Festa Universitária" },
  { id: "e2", title: "Show de Verão" },
];

const order = (o: Record<string, unknown>) => ({
  event_id: "e1", referred_by: null, quantity: 1, subtotal: 0, total_amount: 0, platform_fee: 0, service_fee: 0, payment_status: "confirmed", ...o,
});

const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
const change = (id: string, value: string) => fireEvent.change(byId(id), { target: { value } });

beforeEach(() => {
  mock.state.queries = [];
  mock.state.ignoreFilters = false;
  mock.state.onInsert = undefined;
  toast.mockReset();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
  mock.state.db = {
    event_affiliates: [
      { id: "a1", event_id: "e1", name: "Atlética Engenharia", ref_code: "atletica_engenharia", commission_percent: 10, created_at: "2026-11-01T00:00:00Z" },
      { id: "a2", event_id: "e1", name: "Promoter João", ref_code: "promoter_joao", commission_percent: 7.5, created_at: "2026-11-02T00:00:00Z" },
      { id: "a3", event_id: "e2", name: "Atlética do Show", ref_code: "atletica_show", commission_percent: 5, created_at: "2026-11-02T00:00:00Z" },
    ],
    orders: [
      order({ referred_by: "atletica_engenharia", quantity: 2, subtotal: 100, total_amount: 110, payment_status: "confirmed" }),
      order({ referred_by: "atletica_engenharia", quantity: 1, subtotal: 50, total_amount: 55, payment_status: "paid" }),
      order({ referred_by: null, quantity: 3, subtotal: 150, total_amount: 165, payment_status: "confirmed" }),
      order({ referred_by: "promoter_x", quantity: 4, subtotal: 200, total_amount: 220, payment_status: "confirmed" }),
      // não contam:
      order({ referred_by: "atletica_engenharia", quantity: 9, subtotal: 900, payment_status: "pending" }),
      order({ referred_by: "promoter_x", quantity: 9, subtotal: 900, payment_status: "cancelled" }),
      // outro evento:
      order({ event_id: "e2", referred_by: "atletica_show", quantity: 5, subtotal: 500, payment_status: "confirmed" }),
    ],
    // cortesias existem no banco, mas jamais entram no relatório de comissionados
    tickets: Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`, event_id: "e1", order_id: null, is_complimentary: true, courtesy_type: i % 2 ? "admin" : "organizer", qr_code: `TICKET-C${i}`,
    })),
  };
});

describe("Atléticas & Comissionados — relatório", () => {
  it("agrupa por ?ref=: cadastrados (nome + comissão), orgânico e venda direta; totais fecham com as vendas", async () => {
    render(<AffiliatesSection events={EVENTS} />);

    const atletica = await screen.findByTestId("row-atletica_engenharia");
    expect(atletica).toHaveTextContent("Atlética Engenharia");
    expect(atletica).toHaveTextContent("atletica_engenharia");
    // 2 pedidos (confirmed + paid), 3 ingressos, R$ 150,00, comissão 10% = R$ 15,00
    expect(within(atletica).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Atlética Engenharia",
      "atletica_engenharia",
      "2",
      "3",
      expect.stringMatching(/^R\$\s150,00$/),
      expect.stringMatching(/^R\$\s15,00\(10%\)$/),
    ]);

    const joao = screen.getByTestId("row-promoter_joao");
    expect(joao).toHaveTextContent("Promoter João");
    expect(within(joao).getAllByRole("cell")[2]).toHaveTextContent("0");

    const organic = screen.getByTestId("row-promoter_x");
    expect(organic).toHaveTextContent("não cadastrado");
    expect(within(organic).getAllByRole("cell")[3]).toHaveTextContent("4");

    const direct = screen.getByTestId("row-direct");
    expect(direct).toHaveTextContent("Venda Direta (sem link)");
    expect(within(direct).getAllByRole("cell")[2]).toHaveTextContent("1");
    expect(within(direct).getAllByRole("cell")[3]).toHaveTextContent("3");

    // total: 4 pedidos confirmados, 10 ingressos, R$ 500,00; comissão R$ 15,00
    const total = screen.getByTestId("row-total");
    expect(total).toHaveTextContent(/4\s*10\s*R\$\s500,00\s*R\$\s15,00/);
    expect(screen.getByTestId("summary-Pedidos confirmados")).toHaveTextContent("4");
    expect(screen.getByTestId("summary-Ingressos vendidos")).toHaveTextContent("10");
    expect(screen.getByTestId("summary-Faturamento")).toHaveTextContent(/R\$\s500,00/);
    expect(screen.getByTestId("summary-Comissão estimada")).toHaveTextContent(/R\$\s15,00/);
  });

  it("pedidos pendentes/cancelados e as 25 cortesias NÃO entram; nenhuma consulta lê 'tickets'", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");

    // 900 + 900 + 9 + 9 ingressos de pedidos não confirmados ficaram de fora
    expect(screen.getByTestId("summary-Faturamento")).not.toHaveTextContent("1.800");
    expect(screen.getByTestId("summary-Ingressos vendidos")).toHaveTextContent(/^10$/);
    expect(mock.state.queries.some((q) => q.table === "tickets")).toBe(false);

    const ordersQuery = mock.state.queries.find((q) => q.table === "orders");
    expect(ordersQuery?.filters).toContainEqual(["event_id", "e1"]);
  });

  it("trocar de evento recarrega comissionados e vendas do outro evento", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-atletica_engenharia");

    fireEvent.change(screen.getByLabelText("Evento dos comissionados"), { target: { value: "e2" } });
    const show = await screen.findByTestId("row-atletica_show");
    expect(show).toHaveTextContent("Atlética do Show");
    expect(screen.queryByTestId("row-atletica_engenharia")).not.toBeInTheDocument();
    expect(screen.getByTestId("summary-Ingressos vendidos")).toHaveTextContent(/^5$/);
    // comissão 5% de R$ 500,00
    expect(show).toHaveTextContent(/R\$\s25,00/);
  });
});

describe("Atléticas & Comissionados — gerador de link", () => {
  it("campos vazios: erros inline em pt-BR, foco no primeiro campo e nenhum INSERT", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");
    fireEvent.click(screen.getByRole("button", { name: /gerar link/i }));

    expect(screen.getByText("Informe o nome da atlética ou do comissionado")).toBeInTheDocument();
    expect(screen.getByText("Informe o código do link")).toBeInTheDocument();
    expect(byId("affiliate-name")).toHaveClass("border-destructive");
    expect(byId("affiliate-name")).toHaveAttribute("aria-invalid", "true");
    expect(mock.state.queries.some((q) => q.op === "insert")).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(byId("affiliate-name")));
  });

  it("sugere o código a partir do nome, até o usuário editá-lo", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");

    change("affiliate-name", "Atlética Eng. Civil");
    expect(byId("affiliate-code")).toHaveValue("atletica_eng_civil");

    change("affiliate-code", "ENG Civil 2026");
    expect(byId("affiliate-code")).toHaveValue("eng_civil_2026");
    change("affiliate-name", "Outro Nome");
    expect(byId("affiliate-code")).toHaveValue("eng_civil_2026"); // não sobrescreve mais
  });

  it("comissão inválida mostra erro, e corrigir limpa só esse erro", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");
    change("affiliate-name", "Atlética Nova");
    change("affiliate-commission", "150");
    fireEvent.click(screen.getByRole("button", { name: /gerar link/i }));
    expect(screen.getByText("A comissão deve ficar entre 0% e 100%")).toBeInTheDocument();

    change("affiliate-commission", "7,5");
    expect(screen.queryByText("A comissão deve ficar entre 0% e 100%")).not.toBeInTheDocument();
  });

  it("cadastra: INSERT com os dados normalizados, limpa o formulário e lista o novo link", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");
    change("affiliate-name", "Atlética Nova");
    change("affiliate-commission", "7,5");
    fireEvent.click(screen.getByRole("button", { name: /gerar link/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /copiar link de atlética nova/i })).toBeInTheDocument());
    const insert = mock.state.queries.find((q) => q.op === "insert");
    expect(insert?.payload).toEqual({ event_id: "e1", name: "Atlética Nova", ref_code: "atletica_nova", commission_percent: 7.5 });
    expect(byId("affiliate-name")).toHaveValue("");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link de indicação criado!" }));
    // aparece no relatório (com zero vendas)
    expect(await screen.findByTestId("row-atletica_nova")).toHaveTextContent("Atlética Nova");
  });

  it("código duplicado no evento vira erro inline no campo", async () => {
    mock.state.onInsert = () => ({ code: "23505", message: "duplicate key" });
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");
    change("affiliate-name", "Atlética Engenharia");
    fireEvent.click(screen.getByRole("button", { name: /gerar link/i }));
    expect(await screen.findByText("Já existe um comissionado com este código neste evento")).toBeInTheDocument();
    expect(byId("affiliate-code")).toHaveAttribute("aria-invalid", "true");
  });

  it("Copiar Link copia ${origin}/event/<id>?ref=<código>", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    fireEvent.click(await screen.findByRole("button", { name: /copiar link de atlética engenharia/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/event/e1?ref=atletica_engenharia`),
    );
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link copiado!" }));
  });

  it("excluir pede confirmação e remove o comissionado", async () => {
    render(<AffiliatesSection events={EVENTS} />);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Promoter João" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Excluir Promoter João" })).not.toBeInTheDocument());
    expect(mock.state.db.event_affiliates.find((a) => a.id === "a2")).toBeUndefined();
  });

  it("sem eventos, mostra o estado vazio", () => {
    render(<AffiliatesSection events={[]} />);
    expect(screen.getByText(/Crie um evento para cadastrar/)).toBeInTheDocument();
  });
});

describe("Atléticas & Comissionados — exportar CSV", () => {
  it("baixa um .csv UTF-8 com BOM, separador ';' e os mesmos números do relatório", async () => {
    let blob: Blob | null = null;
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn((b: Blob) => { blob = b; return "blob:fake"; }), configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^comissionados-festa_universitaria-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");
    fireEvent.click(screen.getByRole("button", { name: /exportar csv/i }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(blob).not.toBeNull();
    const bytes = new Uint8Array(await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob as Blob);
    }));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text).toContain("Atlética / Comissionado;Código (?ref=);Pedidos Confirmados;Ingressos Vendidos;Faturamento Gerado (R$);Comissão Estimada (R$)");
    expect(text).toContain("Atlética Engenharia;atletica_engenharia;2;3;150,00;15,00");
    expect(text).toContain("Venda Direta (sem link);;1;3;150,00;0,00");
    expect(text).toContain("Total;;4;10;500,00;15,00");
    click.mockRestore();
  });

  it("desabilitado quando não há pedidos confirmados", async () => {
    mock.state.db.orders = [];
    render(<AffiliatesSection events={EVENTS} />);
    await screen.findByTestId("row-total");
    expect(screen.getByRole("button", { name: /exportar csv/i })).toBeDisabled();
  });
});
