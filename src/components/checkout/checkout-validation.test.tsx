import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutPanel } from "./CheckoutPanel";
import { CheckoutDrawer } from "./CheckoutDrawer";
import type { Event } from "@/types/event";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) }, from: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const event: Event = {
  id: "e1",
  title: "Festa Universitária",
  description: "",
  date: "2026-11-21",
  time: "22:00",
  location: "Foz do Iguaçu",
  venue: "Arena",
  image: "/cover.png",
  price: 50,
  category: "Festa Universitária",
  availableTickets: 100,
  organizer: "org",
  activeBatchId: "b1",
  activeBatchName: "Lote 1",
  showRemainingTickets: false,
};

const type = (container: HTMLElement, id: string, value: string) =>
  fireEvent.change(container.querySelector(`#${id}`) as HTMLInputElement, { target: { value } });

const fillBuyer = (container: HTMLElement, prefix: string) => {
  type(container, `${prefix}-name`, "Ana Souza");
  type(container, `${prefix}-email`, "ana@email.com");
  type(container, `${prefix}-cpf`, "52998224725");
  type(container, `${prefix}-phone`, "11999998888");
};

describe("CheckoutPanel (desktop) – validação inline", () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({ data: { error: "parou aqui" }, error: null });
  });

  const renderPanel = () =>
    render(
      <MemoryRouter>
        <CheckoutPanel event={event} />
      </MemoryRouter>,
    );

  it("PIX com dados vazios: mostra erros, não chama o backend e foca o primeiro campo", async () => {
    const { container } = renderPanel();
    // o botão não fica mais desabilitado: o clique é que explica o que falta
    const button = screen.getByRole("button", { name: /gerar qr code pix/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(screen.getByText("Informe seu nome completo")).toBeInTheDocument();
    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
    expect(screen.getByText("Informe seu CPF")).toBeInTheDocument();
    expect(screen.getByText("Informe seu telefone")).toBeInTheDocument();
    expect(container.querySelector("#p-name")).toHaveClass("border-destructive");
    expect(invoke).not.toHaveBeenCalled();

    await waitFor(() => expect(document.activeElement).toBe(container.querySelector("#p-name")));
  });

  it("exige nome e sobrenome, e-mail válido, CPF com dígitos verificadores e telefone com DDD", () => {
    const { container } = renderPanel();
    type(container, "p-name", "Ana");
    type(container, "p-email", "ana@email");
    type(container, "p-cpf", "11111111111");
    type(container, "p-phone", "119");
    fireEvent.click(screen.getByRole("button", { name: /gerar qr code pix/i }));

    expect(screen.getByText("Informe nome e sobrenome")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido, como nome@email.com")).toBeInTheDocument();
    expect(screen.getByText("CPF inválido. Confira os números digitados")).toBeInTheDocument();
    expect(screen.getByText("Informe o telefone com DDD (10 ou 11 dígitos)")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("limpa cada erro assim que o valor digitado fica válido (mantém a máscara de CPF)", () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /gerar qr code pix/i }));

    type(container, "p-cpf", "52998224725");
    expect(screen.queryByText("Informe seu CPF")).not.toBeInTheDocument();
    expect(container.querySelector("#p-cpf")).toHaveValue("529.982.247-25");
    expect(container.querySelector("#p-cpf")).not.toHaveAttribute("aria-invalid");

    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
  });

  it("dados válidos seguem para o checkout e enviam o telefone", async () => {
    const { container } = renderPanel();
    fillBuyer(container, "p");
    fireEvent.click(screen.getByRole("button", { name: /gerar qr code pix/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke.mock.calls[0][0]).toBe("create-checkout");
    expect(invoke.mock.calls[0][1].body).toMatchObject({
      buyer_name: "Ana Souza",
      buyer_email: "ana@email.com",
      buyer_cpf: "529.982.247-25",
      buyer_phone: "(11) 99999-8888",
    });
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it("cartão: valida também número, titular, validade e CVV", () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Cartão" }));
    fireEvent.click(screen.getByRole("button", { name: /pagar/i }));

    expect(screen.getByText("Informe o número do cartão")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome impresso no cartão")).toBeInTheDocument();
    expect(screen.getByText("Informe a validade")).toBeInTheDocument();
    expect(screen.getByText("Informe o CVV")).toBeInTheDocument();
    expect(screen.getByText("Informe seu CPF")).toBeInTheDocument();
    expect(container.querySelector("#cardNumber")).toHaveAttribute("aria-invalid", "true");
    expect(invoke).not.toHaveBeenCalled();

    type(container, "expiry", "0120");
    expect(screen.getByText("Cartão vencido")).toBeInTheDocument();
  });
});

describe("CheckoutDrawer (mobile) – validação inline", () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({ data: { error: "parou aqui" }, error: null });
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  const renderDrawer = () =>
    render(
      <MemoryRouter>
        <CheckoutDrawer event={event} open onOpenChange={() => {}} />
      </MemoryRouter>,
    );

  it("mostra os mesmos erros no drawer, com ids próprios, e foca o primeiro inválido", async () => {
    renderDrawer();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /gerar qr code pix/i }));

    expect(within(dialog).getByText("Informe seu nome completo")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe seu telefone")).toBeInTheDocument();
    const name = dialog.querySelector("#d-name") as HTMLInputElement;
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveClass("border-destructive");
    expect(invoke).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(name));
  });
});
