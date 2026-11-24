import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Share2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { CheckoutDrawer } from "@/components/checkout/CheckoutDrawer";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/types/event";
import { EventDetailSkeleton } from "@/components/events/EventDetailSkeleton";
import { MobilePurchaseBar } from "@/components/events/MobilePurchaseBar";
import { toast } from "@/hooks/use-toast";
import { captureReferralFromUrl } from "@/lib/referral";
import { usePageMeta } from "@/hooks/usePageMeta";
import { EVENT_FALLBACK_COVER, buildEventMeta } from "@/lib/seo";

export default function EventDetail() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  // Título, descrição e imagem de compartilhamento do evento assim que ele carrega
  usePageMeta(buildEventMeta({ id, loading, event }));

  // Guarda ?ref= (ou ?utm_source=) por 7 dias, para sobreviver a um login/cadastro em /auth
  useEffect(() => {
    if (id) captureReferralFromUrl(search, id);
  }, [id, search]);

  useEffect(() => {
    // Run cleanup of expired pending orders on page load
    supabase.rpc("cleanup_expired_orders").then(({ data }) => {
      const result = data as any;
      if (result?.expired_count > 0)
        console.log(`[Cleanup] Expired ${result.expired_count} pending orders`);
    });
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      setLoading(true);

      const { data } = await supabase
        .from("events")
        .select(
          `
          id, title, description, event_date, event_time,
          location, venue, cover_image_url, category, fee_absorbed, show_remaining_tickets,
          ticket_batches (id, name, price, available_quantity, status, is_active, sort_order)
        `,
        )
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        const batches = (data as any).ticket_batches || [];
        // Prefer the batch explicitly marked as active (is_active = true).
        // Fallback (e.g. new events with no manual selection): first batch with stock by sort order.
        const activeBatch =
          batches.find((b: any) => b.is_active && b.available_quantity > 0) ||
          batches
            .filter((b: any) => b.available_quantity > 0)
            .sort(
              (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
            )[0];
        const totalAvailable = batches.reduce(
          (sum: number, b: any) => sum + (b.available_quantity || 0),
          0,
        );

        setEvent({
          id: data.id,
          title: data.title,
          description: data.description || "",
          date: data.event_date,
          time: data.event_time,
          location: data.location,
          venue: data.venue,
          image: data.cover_image_url || EVENT_FALLBACK_COVER,
          price: activeBatch ? Number(activeBatch.price) : 0,
          category: data.category,
          availableTickets: activeBatch
            ? activeBatch.available_quantity
            : totalAvailable,
          organizer: "",
          activeBatchId: activeBatch?.id,
          activeBatchName: activeBatch?.name,
          showRemainingTickets: !!data.show_remaining_tickets,
        });
      }
      setLoading(false);
    };

    fetchEvent();
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <EventDetailSkeleton />
      </MainLayout>
    );
  }

  if (!event) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Evento não encontrado</h1>
          <Button onClick={() => navigate("/")}>Voltar aos eventos</Button>
        </div>
      </MainLayout>
    );
  }

  const formattedDate = new Date(event.date + "T00:00:00").toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(event.price);

  // Sem ingressos disponíveis no lote ativo: a barra mobile mostra "Esgotado" e o checkout não abre
  const soldOut = event.availableTickets <= 0;

  return (
    <MainLayout>
      <div className="relative">
        <div className="aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 md:top-6 md:left-6 w-11 h-11 md:w-10 md:h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Compartilhar evento"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast({ title: "Link do evento copiado!" });
            } catch {
              toast({ title: "Não foi possível copiar o link", variant: "destructive" });
            }
          }}
          className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 md:w-10 md:h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      <div className="container -mt-16 relative z-10 pb-36 md:pb-10">
        <div className="hidden md:grid md:grid-cols-5 md:gap-8">
          <div className="md:col-span-3">
            <div className="bg-card rounded-2xl shadow-elevated p-6 md:p-8">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {event.category}
                </span>
                {event.activeBatchName && (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-accent text-accent-foreground">
                    {event.activeBatchName}
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4 break-words">
                {event.title}
              </h1>
              <div className="grid gap-2.5 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-primary/70" />
                  <span className="capitalize min-w-0 break-words">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0 text-primary/70" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-primary/70" />
                  <span className="min-w-0 break-words">
                    {event.venue}, {event.location}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 flex-shrink-0 text-primary/70" />
                  <span>
                    {event.showRemainingTickets
                      ? `${event.availableTickets.toLocaleString()} ingressos disponíveis`
                      : "Ingressos disponíveis"}
                  </span>
                </div>
              </div>
              {event.activeBatchName && (
                <div className="mb-6 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-sm font-semibold text-primary break-words">
                    {event.activeBatchName}
                    {event.showRemainingTickets
                      ? ` — Restam ${event.availableTickets} ingresso${event.availableTickets !== 1 ? "s" : ""}`
                      : " — Disponível"}
                  </p>
                </div>
              )}
              <div className="mb-8">
                <h2 className="text-base font-semibold text-foreground mb-2">
                  Sobre o evento
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">
                  {event.description}
                </p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <CheckoutPanel event={event} />
          </div>
        </div>

        <div className="md:hidden">
          <div className="bg-card rounded-2xl shadow-elevated p-5">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {event.category}
              </span>
              {event.activeBatchName && (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-accent text-accent-foreground">
                  {event.activeBatchName}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4 break-words">
              {event.title}
            </h1>
            <div className="grid gap-2.5 mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0 text-primary/70" />
                <span className="capitalize min-w-0 break-words">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0 text-primary/70" />
                <span>{event.time}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0 text-primary/70" />
                <span className="min-w-0 break-words">
                  {event.venue}, {event.location}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 flex-shrink-0 text-primary/70" />
                <span>
                  {event.showRemainingTickets
                    ? `${event.availableTickets.toLocaleString()} ingressos disponíveis`
                    : "Ingressos disponíveis"}
                </span>
              </div>
            </div>
            {event.activeBatchName && (
              <div className="mb-6 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm font-semibold text-primary break-words">
                  {event.activeBatchName}
                  {event.showRemainingTickets
                    ? ` — Restam ${event.availableTickets} ingresso${event.availableTickets !== 1 ? "s" : ""}`
                    : " — Disponível"}
                </p>
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-base font-semibold text-foreground mb-2">
                Sobre o evento
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">
                {event.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <MobilePurchaseBar
        priceLabel={formattedPrice}
        batchName={event.activeBatchName}
        soldOut={soldOut}
        onBuy={() => setDrawerOpen(true)}
      />

      <CheckoutDrawer
        event={event}
        open={drawerOpen && !soldOut}
        onOpenChange={setDrawerOpen}
      />
    </MainLayout>
  );
}
