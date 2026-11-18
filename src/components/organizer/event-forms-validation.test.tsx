import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateEventForm } from "./CreateEventForm";
import { EditEventForm } from "./EditEventForm";

const updateSpy = vi.fn();

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const eventRow = {
  id: "e1",
  title: "Festa",
  description: "",
  event_date: "2026-11-21",
  event_time: "22:00:00",
  event_end_time: null,
  location: "Rua A",
  venue: "A",
  category: "Shows",
  published: true,
  fee_absorbed: false,
  show_remaining_tickets: false,
  cover_image_url: null,
  organizer_id: "o1",
};
const defaultBatches = () => [
  { id: "b1", name: "Lote 1", price: 50, total_quantity: 100, available_quantity: 90, is_active: true, sort_order: 0 },
];
let batchRows = defaultBatches();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "events"
            ? { maybeSingle: async () => ({ data: eventRow, error: null }) }
            : { order: async () => ({ data: batchRows, error: null }) },
      }),
      update: (...args: unknown[]) => {
        updateSpy(table, ...args);
        return { eq: async () => ({ error: null }) };
      },
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "new" }, error: null }) }) }),
      delete: () => ({ eq: async () => ({}), in: async () => ({}) }),
    }),
  },
}));

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

const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
const change = (id: string, value: string) => fireEvent.change(byId(id), { target: { value } });

describe("CreateEventForm – validação por etapa", () => {
  beforeEach(() => updateSpy.mockClear());

  const renderForm = () => render(<CreateEventForm open onOpenChange={() => {}} />);

  it("etapa 1: bloqueia o avanço e mostra o erro de cada campo obrigatório", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /próximo: ingressos/i }));

    expect(screen.getByText("Informe o nome do evento")).toBeInTheDocument();
    expect(screen.getByText("Selecione uma categoria")).toBeInTheDocument();
    expect(screen.getByText("Informe a data do evento")).toBeInTheDocument();
    expect(screen.getByText("Informe o horário de início")).toBeInTheDocument();
    expect(screen.getByText("Informe o local do evento")).toBeInTheDocument();
    expect(byId("event-title")).toHaveClass("border-destructive");
    expect(byId("event-category")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Defina os lotes/)).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(byId("event-title")));
  });

  it("o stepper não permite pular para etapas à frente com dados inválidos", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /3\s*taxas/i }));
    expect(screen.getByText("Informe o nome do evento")).toBeInTheDocument();
    expect(screen.queryByText(/Taxa de serviço: 5%/)).not.toBeInTheDocument();
  });

  const fillStepOne = () => {
    change("event-title", "Festival");
    fireEvent.click(screen.getByRole("button", { name: "Shows" }));
    change("event-date", "2026-12-01");
    change("event-time", "20:00");
    change("event-location", "Parque, Foz");
  };

  it("etapa 2: destaca a linha do lote e o campo exato que falta", async () => {
    renderForm();
    fillStepOne();
    // erros somem conforme cada campo fica válido
    fireEvent.click(screen.getByRole("button", { name: /próximo: ingressos/i }));
    expect(screen.getByText(/Defina os lotes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /adicionar lote/i }));
    change("batch-1-price", "30");
    change("batch-1-quantity", "100");
    // lote 2 sem preço e quantidade
    fireEvent.click(screen.getByRole("button", { name: /próximo: taxas/i }));

    const rows = document.querySelectorAll("div.bg-secondary.rounded-xl");
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveClass("border-destructive/60");
    expect(rows[1]).toHaveClass("border-destructive/60");
    expect(within(rows[1] as HTMLElement).getByText("Informe o preço (use 0 para ingresso gratuito)")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Informe a quantidade")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Taxa de serviço: 5%/)).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(byId("batch-2-price")));

    // preço negativo e quantidade 0 continuam em erro com mensagem específica
    change("batch-2-price", "-5");
    expect(screen.getByText("O preço não pode ser negativo")).toBeInTheDocument();
    change("batch-2-quantity", "0");
    expect(screen.getByText("A quantidade mínima é 1")).toBeInTheDocument();

    // preço 0 (gratuito) é válido
    change("batch-2-price", "0");
    change("batch-2-quantity", "10");
    expect(rows[1]).not.toHaveClass("border-destructive/60");
    fireEvent.click(screen.getByRole("button", { name: /próximo: taxas/i }));
    expect(screen.getByText(/Taxa de serviço: 5%/)).toBeInTheDocument();
  });

  it("ids de lote continuam únicos depois de remover e adicionar lotes", () => {
    renderForm();
    fillStepOne();
    fireEvent.click(screen.getByRole("button", { name: /próximo: ingressos/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar lote/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /adicionar lote/i }));
    const ids = Array.from(document.querySelectorAll('input[id^="batch-"][id$="-price"]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("EditEventForm – validação inline", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    batchRows = defaultBatches();
  });

  const renderEdit = async () => {
    render(<EditEventForm eventId="e1" open onOpenChange={() => {}} />);
    await waitFor(() => expect(byId("edit-title")).toHaveValue("Festa"));
  };

  it("não salva com campos obrigatórios vazios e mostra o erro em cada um", async () => {
    await renderEdit();
    change("edit-title", "");
    change("edit-date", "");
    change("edit-time", "");
    change("edit-location", "");
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(screen.getByText("Informe o nome do evento")).toBeInTheDocument();
    expect(screen.getByText("Informe a data do evento")).toBeInTheDocument();
    expect(screen.getByText("Informe o horário de início")).toBeInTheDocument();
    expect(screen.getByText("Informe o local do evento")).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(byId("edit-title")));

    change("edit-title", "Festa 2");
    expect(screen.queryByText("Informe o nome do evento")).not.toBeInTheDocument();
  });

  it("lote: campos vazios, preço negativo e quantidade abaixo do já vendido", async () => {
    await renderEdit();
    change("edit-batch-b1-price", "");
    change("edit-batch-b1-quantity", "5"); // 10 já vendidos (100 - 90)
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(screen.getByText("Informe o preço (use 0 para ingresso gratuito)")).toBeInTheDocument();
    expect(
      screen.getByText("Já foram vendidos 10 ingressos neste lote; a quantidade não pode ser menor"),
    ).toBeInTheDocument();
    expect(byId("edit-batch-b1-price")).toHaveClass("border-destructive");
    expect(updateSpy).not.toHaveBeenCalled();

    change("edit-batch-b1-price", "-1");
    expect(screen.getByText("O preço não pode ser negativo")).toBeInTheDocument();
    change("edit-batch-b1-price", "60");
    change("edit-batch-b1-quantity", "100");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls.map((call) => call[0])).toEqual(["events", "ticket_batches"]);
  });

  it("exige ao menos um lote (lote sem vendas pode ser removido, mas não dá para salvar sem nenhum)", async () => {
    batchRows = [{ ...defaultBatches()[0], available_quantity: 100 }];
    await renderEdit();
    fireEvent.click(screen.getByRole("button", { name: /remover lote 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(screen.getByText("Adicione pelo menos um lote de ingressos")).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /novo lote/i }));
    expect(screen.getByText("Adicione pelo menos um lote de ingressos")).toBeInTheDocument(); // só some no próximo envio
  });

  it("lote com vendas não pode ser removido", async () => {
    await renderEdit();
    fireEvent.click(screen.getByRole("button", { name: /remover lote 1/i }));
    expect(byId("edit-batch-b1-price")).toBeInTheDocument();
  });
});
