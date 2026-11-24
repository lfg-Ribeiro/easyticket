import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, Home, Loader2, MapPin, Share2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { OfflineTip } from "@/components/tickets/OfflineTip";
import { WalletButton } from "@/components/tickets/WalletButton";
import { OrderSummaryCard, type PurchaseEventInfo } from "@/components/purchase/OrderSummaryCard";
import { PurchaseFallback } from "@/components/purchase/PurchaseFallback";
import { TicketAccessCard } from "@/components/purchase/TicketAccessCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { isPaymentConfirmed } from "@/lib/payment-status";
import { buildEventUrl, formatOrderRef, readPurchaseParams } from "@/lib/purchase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { pageTitle } from "@/lib/seo";

const FALLBACK_COVER = "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop";
const TICKET_FETCH_DELAY_MS = 1500;

interface OrderInfo {
  event_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_amount: number;
  transaction_id: string | null;
}

function PurchaseSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Carregando sua compra…</span>
      <div aria-hidden="true" className="space-y-3 text-center">
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-72 max-w-full" />
      </div>
      <Skeleton aria-hidden="true" className="h-80 w-full rounded-2xl" />
      <Skeleton aria-hidden="true" className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export default function PurchaseSuccess() {
  usePageMeta({
    title: pageTitle("Compra Confirmada"),
    description: "Sua compra no EasyTicket foi concluída. Acesse seus ingressos digitais.",
    noindex: true,
  });

  const [searchParams] = useSearchParams();
  const params = useMemo(() => readPurchaseParams(searchParams), [searchParams]);
  const { eventId: paramEventId, orderId, paymentId, qrCode: qrCodeFromUrl } = params;
  const hasReference = Boolean(paramEventId || orderId);

  const [loading, setLoading] = useState(hasReference);
  const [eventId, setEventId] = useState(paramEventId);
  const [eventData, setEventData] = useState<PurchaseEventInfo | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [qrCodes, setQrCodes] = useState<string[]>(qrCodeFromUrl ? [qrCodeFromUrl] : []);
  const [batchName, setBatchName] = useState(params.batchName);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "confirmed">(
    paymentId ? "pending" : "confirmed"
  );
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pedido + evento. O pedido é "melhor esforço": para convidados o RLS pode bloquear a leitura,
  // e nesse caso a página continua funcionando com os dados que vieram na URL.
  useEffect(() => {
    if (!hasReference) return;
    let active = true;

    const load = async () => {
      let resolvedEventId = paramEventId;

      if (orderId) {
        const { data } = await supabase
          .from("orders")
          .select("event_id, buyer_name, buyer_email, quantity, total_amount, transaction_id")
          .eq("id", orderId)
          .maybeSingle();
        if (!active) return;
        if (data) {
          setOrder(data);
          resolvedEventId = resolvedEventId || data.event_id;
        }
      }

      if (resolvedEventId) {
        const { data } = await supabase
          .from("events")
          .select("title, cover_image_url, event_date, event_time, venue, location")
          .eq("id", resolvedEventId)
          .maybeSingle();
        if (!active) return;
        if (data) {
          setEventId(resolvedEventId);
          setEventData({
            title: data.title,
            image: data.cover_image_url || FALLBACK_COVER,
            date: data.event_date,
            time: data.event_time,
            venue: data.venue,
            location: data.location,
          });
        }
      }

      if (active) setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [hasReference, paramEventId, orderId]);

  // Ingressos do pedido (todos os QR Codes) e nome do lote — também melhor esforço.
  useEffect(() => {
    if (!orderId) return;
    let active = true;

    const fetchTickets = async () => {
      // Sem QR Code na URL, espera um pouco para a emissão dos ingressos terminar.
      if (!qrCodeFromUrl) await new Promise((resolve) => setTimeout(resolve, TICKET_FETCH_DELAY_MS));
      if (!active) return;

      const { data } = await supabase
        .from("tickets")
        .select("qr_code, batch_id")
        .eq("order_id", orderId)
        .limit(20);
      if (!active || !data?.length) return;

      setQrCodes(data.map((ticket) => ticket.qr_code).filter(Boolean));

      const batchId = data[0].batch_id;
      if (batchId && !params.batchName) {
        const { data: batch } = await supabase
          .from("ticket_batches")
          .select("name")
          .eq("id", batchId)
          .maybeSingle();
        if (active && batch?.name) setBatchName(batch.name);
      }
    };

    fetchTickets();
    return () => {
      active = false;
    };
  }, [orderId, qrCodeFromUrl, params.batchName]);

  // Polling for Asaas payment confirmation
  useEffect(() => {
    if (!paymentId || paymentStatus === "confirmed") return;

    let active = true;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-payment-status", {
          body: { payment_id: paymentId, order_id: orderId },
        });
        if (!active) return;
        if (error) {
          console.error("Payment status check error:", error);
          return;
        }
        if (isPaymentConfirmed(data)) {
          setPaymentStatus("confirmed");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);

    return () => {
      active = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentId, orderId, paymentStatus]);

  const confirmed = paymentStatus === "confirmed";
  const orderRef = formatOrderRef(orderId, order?.transaction_id ?? params.transactionId);
  const buyerName = order?.buyer_name || params.name;
  const buyerEmail = order?.buyer_email || params.email;
  const quantity = order?.quantity ?? params.quantity;
  const total = order ? Number(order.total_amount) : params.total;

  const generateGoogleCalendarUrl = () => {
    if (!eventData) return "#";
    const dateStr = eventData.date.replace(/-/g, "");
    const timeStr = eventData.time.replace(/:/g, "").slice(0, 4);
    const startDateTime = `${dateStr}T${timeStr}00`;
    const endDate = new Date(`${eventData.date}T${eventData.time}`);
    endDate.setHours(endDate.getHours() + 3);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const endDateTime = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    const calendarParams = new URLSearchParams({
      action: "TEMPLATE",
      text: eventData.title,
      dates: `${startDateTime}/${endDateTime}`,
      location: `${eventData.venue}, ${eventData.location}`,
      details: `Ingresso EasyTicket${orderRef ? ` - ${orderRef}` : ""}`,
    });
    return `https://calendar.google.com/calendar/render?${calendarParams.toString()}`;
  };

  const getDirectionsUrl = () => {
    if (!eventData) return "#";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventData.venue}, ${eventData.location}`)}`;
  };

  const handleShare = async () => {
    if (!eventData || !eventId) return;
    const url = buildEventUrl(eventId);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: eventData.title, text: `Vou para ${eventData.title}! Garanta o seu ingresso:`, url });
        return;
      } catch (err) {
        // Usuário fechou o menu de compartilhamento: nada a fazer.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Qualquer outra falha: cai para copiar o link.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link do evento copiado!", description: "Cole onde quiser para convidar seus amigos." });
    } catch {
      toast({ title: "Não foi possível copiar o link", description: url, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-8">
          <PurchaseSkeleton />
        </div>
      </MainLayout>
    );
  }

  if (!hasReference || !eventData) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-12">
          <PurchaseFallback reason={hasReference ? "unavailable" : "missing"} orderRef={orderRef} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-lg space-y-6 py-8">
        {/* Cabeçalho de confirmação */}
        <header className="animate-fade-up space-y-3 text-center" role="status" aria-live="polite">
          <div className="relative mx-auto h-20 w-20">
            {confirmed && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-success/20 motion-safe:animate-ping"
                style={{ animationIterationCount: 2, animationDuration: "1.6s" }}
              />
            )}
            <div
              className={`relative flex h-20 w-20 items-center justify-center rounded-full ring-4 animate-scale-in ${
                confirmed ? "bg-success/10 ring-success/20" : "bg-primary/10 ring-primary/20"
              }`}
            >
              {confirmed ? (
                <Check className="h-10 w-10 text-success" strokeWidth={3} aria-hidden="true" />
              ) : (
                <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
              )}
            </div>
          </div>

          {confirmed && (
            <Badge className="border-success/20 bg-success/10 text-success hover:bg-success/10">
              Pagamento aprovado
            </Badge>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {confirmed ? "Compra confirmada!" : "Processando pagamento…"}
          </h1>
          {orderRef && (
            <p className="text-xs text-muted-foreground">
              Pedido <span className="font-mono font-semibold text-foreground">{orderRef}</span>
            </p>
          )}
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {confirmed ? (
              <>
                Seus ingressos já estão vinculados à sua conta e ao CPF informado na compra
                {buyerEmail ? (
                  <>
                    {" "}e foram enviados para <span className="font-semibold text-foreground">{buyerEmail}</span>
                  </>
                ) : null}
                .
              </>
            ) : (
              <>
                Estamos aguardando a confirmação do seu pagamento PIX. Isso pode levar alguns instantes.
                <span className="mt-1 block text-xs">Verificando automaticamente a cada 5 segundos.</span>
              </>
            )}
          </p>
        </header>

        <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <OrderSummaryCard
            event={eventData}
            quantity={quantity}
            batchName={batchName}
            buyerName={buyerName}
            buyerEmail={buyerEmail}
            total={total}
            paid={confirmed}
          />
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <TicketAccessCard qrCodes={qrCodes} quantity={quantity} confirmed={confirmed} email={buyerEmail} />
        </div>

        <div className="animate-fade-up space-y-3" style={{ animationDelay: "300ms" }}>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => window.open(generateGoogleCalendarUrl(), "_blank")} variant="outline" size="lg" className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Adicionar ao Calendário
            </Button>
            <Button onClick={() => window.open(getDirectionsUrl(), "_blank")} variant="outline" size="lg" className="gap-2">
              <MapPin className="h-4 w-4" />
              Como Chegar
            </Button>
          </div>
          <Button onClick={handleShare} variant="secondary" size="lg" className="w-full gap-2">
            <Share2 className="h-4 w-4" />
            Compartilhar evento
          </Button>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "350ms" }}>
          <WalletButton />
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "350ms" }}>
          <OfflineTip />
        </div>

        <div className="animate-fade-up pt-2" style={{ animationDelay: "400ms" }}>
          <Button asChild variant="ghost" size="lg" className="w-full gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Ver mais eventos
            </Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
