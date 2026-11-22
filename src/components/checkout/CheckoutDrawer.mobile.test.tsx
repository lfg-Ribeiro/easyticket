import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureReferralFromUrl } from "@/lib/referral";
import type { Event } from "@/types/event";
import { CheckoutDrawer } from "./CheckoutDrawer";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn(async () => ({ data: null, error: null })), from: vi.fn() },
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

const renderDrawer = () => {
  render(
    <MemoryRouter>
      <CheckoutDrawer event={event} open onOpenChange={() => {}} />
    </MemoryRouter>,
  );
  return screen.getByRole("dialog");
};
const input = (dialog: HTMLElement, id: string) => dialog.querySelector(`#${id}`) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/event/e1");
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("CheckoutDrawer — ergonomia no celular", () => {
  it("usa altura dinâmica (90dvh), rolagem interna suave e respeita a área segura do iPhone", () => {
    const dialog = renderDrawer();
    expect(dialog).toHaveClass("max-h-[90dvh]");
    const scroller = dialog.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller).toHaveClass(
      "overflow-y-auto",
      "overscroll-contain",
      "scroll-smooth",
      "pb-[calc(1rem+env(safe-area-inset-bottom))]",
      "max-h-[calc(90dvh-6rem)]",
    );
  });

  it("abre o teclado certo: numérico para CPF e telefone, e-mail para e-mail", () => {
    const dialog = renderDrawer();
    expect(input(dialog, "d-cpf")).toHaveAttribute("inputmode", "numeric");
    expect(input(dialog, "d-phone")).toHaveAttribute("inputmode", "numeric");
    expect(input(dialog, "d-phone")).toHaveAttribute("type", "tel");
    expect(input(dialog, "d-email")).toHaveAttribute("inputmode", "email");
    expect(input(dialog, "d-email")).toHaveAttribute("type", "email");
    expect(input(dialog, "d-name")).toHaveAttribute("autocomplete", "name");
    expect(input(dialog, "d-name")).toHaveAttribute("autocapitalize", "words");
  });

  it("todos os campos do comprador têm área de toque de 44px", () => {
    const dialog = renderDrawer();
    ["d-name", "d-email", "d-cpf", "d-phone"].forEach((id) => expect(input(dialog, id)).toHaveClass("min-h-[44px]"));
  });

  it("botões de quantidade (-/+) têm 44px, nome acessível e funcionam", () => {
    const dialog = renderDrawer();
    const minus = within(dialog).getByRole("button", { name: "Diminuir quantidade" });
    const plus = within(dialog).getByRole("button", { name: "Aumentar quantidade" });
    [minus, plus].forEach((button) => expect(button).toHaveClass("h-11", "w-11", "min-h-[44px]", "min-w-[44px]"));
    expect(minus).toBeDisabled(); // quantidade mínima: 1

    fireEvent.click(plus);
    expect(within(dialog).getByText("2")).toHaveAttribute("aria-live", "polite");
    expect(minus).toBeEnabled();
  });

  it("abas de pagamento (PIX / Cartão): 44px, estado acessível e campos do cartão com teclado numérico", () => {
    const dialog = renderDrawer();
    const pix = within(dialog).getByRole("button", { name: "PIX" });
    const card = within(dialog).getByRole("button", { name: "Cartão" });
    [pix, card].forEach((tab) => expect(tab).toHaveClass("min-h-[44px]"));
    expect(pix).toHaveAttribute("aria-pressed", "true");
    expect(card).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(pix).toHaveAttribute("aria-pressed", "false");

    const number = input(dialog, "d-cardNumber");
    expect(number).toHaveAttribute("inputmode", "numeric");
    expect(number).toHaveAttribute("autocomplete", "cc-number");
    expect(input(dialog, "d-expiry")).toHaveAttribute("inputmode", "numeric");
    expect(input(dialog, "d-cvv")).toHaveAttribute("inputmode", "numeric");
    expect(input(dialog, "d-holderName")).toHaveAttribute("autocapitalize", "characters");
    ["d-cardNumber", "d-holderName", "d-expiry", "d-cvv"].forEach((id) => expect(input(dialog, id)).toHaveClass("min-h-[44px]"));
  });

  it("botão de fechar e botão de ação do PIX têm área de toque adequada", () => {
    const dialog = renderDrawer();
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toHaveClass("h-11", "w-11");
    expect(within(dialog).getByRole("button", { name: /gerar qr code pix/i })).toHaveClass("min-h-[44px]");
  });

  it("a validação continua funcionando: campos vazios mostram erros e foco no primeiro", async () => {
    const dialog = renderDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: /gerar qr code pix/i }));
    expect(within(dialog).getByText("Informe seu nome completo")).toBeInTheDocument();
    expect(within(dialog).getByText("Informe seu telefone")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(input(dialog, "d-name")));
  });

  it("selo de indicação (?ref=) com nome longo quebra linha e não estoura o drawer", async () => {
    captureReferralFromUrl(`?ref=${"atletica_de_engenharia_civil_".repeat(2)}turma_2026`, "e1");
    const dialog = renderDrawer();
    const badge = await within(dialog).findByTestId("referral-badge");
    expect(badge).toHaveClass("max-w-full");
    expect(badge.querySelector("span")).toHaveClass("break-words", "min-w-0");
  });
});
