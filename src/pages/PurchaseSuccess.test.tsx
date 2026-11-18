import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseSuccess from "./PurchaseSuccess";

type Row = Record<string, unknown>;
const tables: { orders: Row | null; events: Row | null; tickets: Row[]; ticket_batches: Row | null } = {
  orders: null,
  events: null,
  tickets: [],
  ticket_batches: null,
};
const invoke = vi.fn();
const toast = vi.fn();

const makeQuery = (table: keyof typeof tables) => {
  const value = tables[table];
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: Array.isArray(value) ? value[0] ?? null : value, error: null }),
    then: (resolve: (result: { data: Row[]; error: null }) => void) =>
      resolve({ data: Array.isArray(value) ? value : [], error: null }),
  };
  return query;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: keyof typeof tables) => makeQuery(table),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/tickets/WalletButton", () => ({ WalletButton: () => null }));
vi.mock("@/components/tickets/OfflineTip", () => ({ OfflineTip: () => null }));

const EVENT_ROW = {
  title: "Festa Universitária",
  cover_image_url: "/cover.png",
  event_date: "2026-11-21",
  event_time: "22:00:00",
  venue: "Arena Iguaçu",
  location: "Foz do Iguaçu",
};
const ORDER_ID = "a1b2c3d4-0000-4000-8000-000000000000";
const FULL_QUERY =
  `eventId=e1&orderId=${ORDER_ID}&name=Ana+Souza&email=ana%40email.com&quantity=2&txn=TXN-1&qrCode=QR-FROM-URL&total=105.00&batch=Lote+1`;

const renderPage = (query: string, path = "/purchase-success") =>
  render(
    <MemoryRouter initialEntries={[`${path}?${query}`]}>
      <PurchaseSuccess />
    </MemoryRouter>,
  );

const setClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
const setShare = (share?: (data: ShareData) => Promise<void>) =>
  Object.defineProperty(navigator, "share", { value: share, configurable: true });

describe("PurchaseSuccess", () => {
  beforeEach(() => {
    tables.orders = null;
    tables.events = EVENT_ROW;
    tables.tickets = [];
    tables.ticket_batches = null;
    invoke.mockReset();
    toast.mockReset();
    setShare(undefined);
    setClipboard(vi.fn().mockResolvedValue(undefined));
  });
  afterEach(() => vi.restoreAllMocks());

  it("compra confirmada: cabeçalho, referência do pedido e resumo completo (dados da URL)", async () => {
    renderPage(FULL_QUERY);

    expect(await screen.findByRole("heading", { level: 1, name: "Compra confirmada!" })).toBeInTheDocument();
    expect(screen.getByText("Pagamento aprovado")).toBeInTheDocument();
    expect(screen.getByText("#A1B2C3D4")).toBeInTheDocument();
    expect(screen.getByText(/vinculados à sua conta e ao CPF informado/i)).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Resumo do pedido" });
    expect(summary).toHaveTextContent("Festa Universitária");
    expect(summary).toHaveTextContent(/sábado, 21 de novembro de 2026/i);
    expect(summary).toHaveTextContent("22:00");
    expect(summary).toHaveTextContent("Arena Iguaçu, Foz do Iguaçu");
    expect(summary).toHaveTextContent("2 ingressos");
    expect(summary).toHaveTextContent("Lote 1");
    expect(summary).toHaveTextContent("Ana Souza");
    expect(summary).toHaveTextContent("ana@email.com");
    expect(summary).toHaveTextContent(/Total pago\s*R\$\s105,00/);
  });

  it("mostra o QR Code real e o CTA principal 'Acessar Meus Ingressos'", async () => {
    renderPage(FULL_QUERY);
    const qr = await screen.findByRole("img", { name: "QR Code do ingresso 1" });
    expect(qr.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Acessar Meus Ingressos" })).toHaveAttribute("href", "/tickets");
    expect(screen.getByRole("link", { name: /ver mais eventos/i })).toHaveAttribute("href", "/");
  });

  it("aceita os aliases snake_case (order_id, event_id, qr_code) e a rota /obrigado", async () => {
    renderPage(`event_id=e1&order_id=${ORDER_ID}&qr_code=QR-ALIAS&name=Ana+Souza&quantity=1`, "/obrigado");
    expect(await screen.findByRole("heading", { level: 1, name: "Compra confirmada!" })).toBeInTheDocument();
    expect(screen.getByText("#A1B2C3D4")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "QR Code do ingresso 1" })).toBeInTheDocument();
  });

  it("quando o RLS libera o pedido, os dados do banco têm prioridade sobre a URL", async () => {
    tables.orders = {
      event_id: "e1",
      buyer_name: "Ana Souza",
      buyer_email: "ana@email.com",
      quantity: 3,
      total_amount: 157.5,
      transaction_id: "TXN-DB",
    };
    tables.tickets = [
      { qr_code: "QR-1", batch_id: "b1" },
      { qr_code: "QR-2", batch_id: "b1" },
      { qr_code: "QR-3", batch_id: "b1" },
    ];
    tables.ticket_batches = { name: "Lote Promocional" };
    renderPage(`orderId=${ORDER_ID}&qrCode=QR-1&quantity=1&total=10.00`);

    const summary = await screen.findByRole("region", { name: "Resumo do pedido" });
    expect(summary).toHaveTextContent("3 ingressos");
    expect(summary).toHaveTextContent(/Total pago\s*R\$\s157,50/);
    await waitFor(() => expect(summary).toHaveTextContent("Lote Promocional"));
    await waitFor(() => expect(screen.getAllByRole("img", { name: /QR Code do ingresso/ })).toHaveLength(3));
  });

  it("não inventa QR Code: sem código disponível, direciona para Meus Ingressos", async () => {
    renderPage("eventId=e1&name=Ana+Souza&email=ana%40email.com&quantity=1");
    expect(await screen.findByText(/QR Code já está disponível em Meus Ingressos/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR Code/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acessar Meus Ingressos" })).toHaveAttribute("href", "/tickets");
  });

  describe("compartilhar evento", () => {
    it("sem Web Share API: copia o link público do evento e mostra o toast", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      setClipboard(writeText);
      renderPage(FULL_QUERY);

      fireEvent.click(await screen.findByRole("button", { name: /compartilhar evento/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/event/e1`));
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Link do evento copiado!" }));
    });

    it("com Web Share API: usa navigator.share e não copia", async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      const writeText = vi.fn().mockResolvedValue(undefined);
      setShare(share);
      setClipboard(writeText);
      renderPage(FULL_QUERY);

      fireEvent.click(await screen.findByRole("button", { name: /compartilhar evento/i }));
      await waitFor(() =>
        expect(share).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Festa Universitária", url: `${window.location.origin}/event/e1` }),
        ),
      );
      expect(writeText).not.toHaveBeenCalled();
    });

    it("se o compartilhamento falhar (≠ cancelado), cai para copiar o link", async () => {
      setShare(vi.fn().mockRejectedValue(new Error("falhou")));
      const writeText = vi.fn().mockResolvedValue(undefined);
      setClipboard(writeText);
      renderPage(FULL_QUERY);

      fireEvent.click(await screen.findByRole("button", { name: /compartilhar evento/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
    });

    it("se o usuário cancelar o compartilhamento, não copia nada", async () => {
      setShare(vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError")));
      const writeText = vi.fn().mockResolvedValue(undefined);
      setClipboard(writeText);
      renderPage(FULL_QUERY);

      fireEvent.click(await screen.findByRole("button", { name: /compartilhar evento/i }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(writeText).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe("pagamento PIX pendente", () => {
    it("mostra 'Processando', não libera o QR Code e passa para confirmado após o polling", async () => {
      invoke.mockResolvedValueOnce({ data: { status: "pending" }, error: null });
      invoke.mockResolvedValue({ data: { status: "confirmed" }, error: null });
      renderPage(`${FULL_QUERY}&paymentId=pay_1`);

      expect(await screen.findByRole("heading", { level: 1, name: "Processando pagamento…" })).toBeInTheDocument();
      expect(screen.getByText(/será liberado assim que o pagamento for confirmado/i)).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /QR Code/ })).not.toBeInTheDocument();
      expect(invoke).toHaveBeenCalledWith("check-payment-status", { body: { payment_id: "pay_1", order_id: ORDER_ID } });

      await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Compra confirmada!" })).toBeInTheDocument(), {
        timeout: 7000,
      });
      expect(screen.getByRole("img", { name: "QR Code do ingresso 1" })).toBeInTheDocument();
    }, 12000);
  });

  describe("estados de erro", () => {
    it("sem parâmetros: mostra um cartão amigável com caminhos para /tickets e /", async () => {
      renderPage("");
      expect(await screen.findByRole("heading", { name: /não encontramos os dados da sua compra/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /ver meus ingressos/i })).toHaveAttribute("href", "/tickets");
      expect(screen.getByRole("link", { name: /explorar eventos/i })).toHaveAttribute("href", "/");
      expect(screen.queryByRole("button", { name: /compartilhar/i })).not.toBeInTheDocument();
    });

    it("evento inexistente: também cai no estado amigável, com a referência do pedido", async () => {
      tables.events = null;
      renderPage(`eventId=nao-existe&orderId=${ORDER_ID}`);
      expect(await screen.findByRole("heading", { name: /não encontramos os dados da sua compra/i })).toBeInTheDocument();
      expect(screen.getByText("#A1B2C3D4")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /ver meus ingressos/i })).toHaveAttribute("href", "/tickets");
    });
  });
});
