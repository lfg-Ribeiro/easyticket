import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { captureReferralFromUrl } from "@/lib/referral";
import type { Event } from "@/types/event";
import { CheckoutDrawer } from "./CheckoutDrawer";
import { CheckoutPanel } from "./CheckoutPanel";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), calls: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: (name: string, args?: unknown) => mock.rpc(name, args),
    from: vi.fn(),
  },
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

const attachCalls = () => mock.rpc.mock.calls.filter(([name]) => name === "attach_order_referral");
const flow = () => mock.calls.filter((c) => c !== "rpc:get_affiliate_name");

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/event/e1");
  mock.calls = [];
  mock.rpc.mockReset().mockImplementation(async (name: string) => {
    mock.calls.push(`rpc:${name}`);
    if (name === "attach_order_referral") return { data: true, error: null };
    if (name === "get_affiliate_name") return { data: null, error: null };
    return { data: null, error: null };
  });
  (supabase.functions.invoke as Mock).mockReset().mockImplementation(async (name: string) => {
    mock.calls.push(`invoke:${name}`);
    if (name === "create-checkout") {
      return { data: { order: { id: "order-1" }, transaction_id: "TXN-1", tickets: [{ qr_code: "TICKET-AAAAAAAA-1-BBBBBBBB" }] }, error: null };
    }
    if (name === "create-pix-payment") {
      return { data: { pix_code: "00020126", qr_code_image: null, payment_id: "pay_1" }, error: null };
    }
    return { data: null, error: null };
  });
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <CheckoutPanel event={event} />
    </MemoryRouter>,
  );

const generatePix = (container: HTMLElement) => {
  fillBuyer(container, "p");
  fireEvent.click(screen.getByRole("button", { name: /gerar qr code pix/i }));
};

describe("Checkout — indicação (?ref=) gravada no pedido", () => {
  it("logo após o create-checkout, chama attach_order_referral com o order_id e o código (antes do PIX)", async () => {
    captureReferralFromUrl("?ref=Atlética Engenharia", "e1");
    const { container } = renderPanel();
    generatePix(container);

    await waitFor(() => expect(flow()).toContain("invoke:create-pix-payment"));
    expect(flow()).toEqual(["invoke:create-checkout", "rpc:attach_order_referral", "invoke:create-pix-payment"]);
    expect(attachCalls()).toEqual([
      ["attach_order_referral", { p_order_id: "order-1", p_referred_by: "atletica_engenharia" }],
    ]);
  });

  it("usa ?ref= da URL atual (captura na própria página do checkout)", async () => {
    window.history.pushState({}, "", "/event/e1?ref=promoter_joao");
    const { container } = renderPanel();
    generatePix(container);
    await waitFor(() => expect(attachCalls()).toHaveLength(1));
    expect(attachCalls()[0][1]).toEqual({ p_order_id: "order-1", p_referred_by: "promoter_joao" });
  });

  it("?utm_source= funciona como alternativa, e ?ref= tem prioridade", async () => {
    window.history.pushState({}, "", "/event/e1?utm_source=Instagram&ref=Atlética Eng");
    const { container } = renderPanel();
    generatePix(container);
    await waitFor(() => expect(attachCalls()).toHaveLength(1));
    expect(attachCalls()[0][1]).toMatchObject({ p_referred_by: "atletica_eng" });
  });

  it("a indicação sobrevive a um desvio por /auth (URL do checkout volta sem ?ref=)", async () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e1"); // clicou no link da atlética
    window.history.pushState({}, "", "/auth"); // foi logar/cadastrar
    window.history.pushState({}, "", "/event/e1"); // voltou ao evento, sem ?ref=
    const { container } = renderPanel();
    generatePix(container);
    await waitFor(() => expect(attachCalls()).toHaveLength(1));
    expect(attachCalls()[0][1]).toEqual({ p_order_id: "order-1", p_referred_by: "atletica_engenharia" });
  });

  it("sem indicação, nada é gravado e a compra segue normalmente", async () => {
    const { container } = renderPanel();
    generatePix(container);
    await waitFor(() => expect(flow()).toContain("invoke:create-pix-payment"));
    expect(attachCalls()).toHaveLength(0);
    expect(flow()).toEqual(["invoke:create-checkout", "invoke:create-pix-payment"]);
  });

  it("indicação de outro evento não é aplicada a esta compra", async () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e2");
    const { container } = renderPanel();
    expect(screen.queryByTestId("referral-badge")).not.toBeInTheDocument();
    generatePix(container);
    await waitFor(() => expect(flow()).toContain("invoke:create-pix-payment"));
    expect(attachCalls()).toHaveLength(0);
  });

  it("se a gravação da indicação falhar (RPC com erro ou exceção), o pagamento NÃO é bloqueado", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    mock.rpc.mockImplementation(async (name: string) => {
      mock.calls.push(`rpc:${name}`);
      if (name === "attach_order_referral") throw new Error("rede caiu");
      return { data: null, error: null };
    });
    const { container } = renderPanel();
    generatePix(container);
    await waitFor(() => expect(flow()).toContain("invoke:create-pix-payment"));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("pedido sem order_id na resposta não tenta gravar indicação", async () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    (supabase.functions.invoke as Mock).mockImplementation(async (name: string) => {
      mock.calls.push(`invoke:${name}`);
      return name === "create-checkout"
        ? { data: { order: {}, transaction_id: "TXN-1" }, error: null }
        : { data: { pix_code: "x", payment_id: "p" }, error: null };
    });
    const { container } = renderPanel();
    generatePix(container);
    await waitFor(() => expect(flow()).toContain("invoke:create-pix-payment"));
    expect(attachCalls()).toHaveLength(0);
  });
});

describe("Checkout — selo 'Indicação'", () => {
  it("mostra o código quando não há comissionado cadastrado", async () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    renderPanel();
    expect(await screen.findByTestId("referral-badge")).toHaveTextContent("Indicação: atletica_engenharia");
  });

  it("mostra o nome do comissionado cadastrado (via RPC pública, sem expor a comissão)", async () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    mock.rpc.mockImplementation(async (name: string) =>
      name === "get_affiliate_name" ? { data: "Atlética Engenharia", error: null } : { data: null, error: null },
    );
    renderPanel();
    await waitFor(() => expect(screen.getByTestId("referral-badge")).toHaveTextContent("Indicação: Atlética Engenharia"));
    expect(mock.rpc).toHaveBeenCalledWith("get_affiliate_name", { p_event_id: "e1", p_ref_code: "atletica_engenharia" });
  });

  it("não aparece sem indicação", () => {
    renderPanel();
    expect(screen.queryByTestId("referral-badge")).not.toBeInTheDocument();
  });
});

describe("CheckoutDrawer (mobile) — indicação", () => {
  beforeEach(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("mostra o selo e grava a indicação no pedido do mesmo jeito", async () => {
    captureReferralFromUrl("?ref=atletica_engenharia", "e1");
    render(
      <MemoryRouter>
        <CheckoutDrawer event={event} open onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByTestId("referral-badge")).toHaveTextContent("Indicação: atletica_engenharia");

    fillBuyer(dialog, "d");
    fireEvent.click(within(dialog).getByRole("button", { name: /gerar qr code pix/i }));
    await waitFor(() => expect(attachCalls()).toHaveLength(1));
    expect(attachCalls()[0][1]).toEqual({ p_order_id: "order-1", p_referred_by: "atletica_engenharia" });
    expect(flow().slice(0, 2)).toEqual(["invoke:create-checkout", "rpc:attach_order_referral"]);
  });
});
