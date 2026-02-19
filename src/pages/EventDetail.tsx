import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Share2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { CheckoutDrawer } from "@/components/checkout/CheckoutDrawer";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/types/event";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      setLoading(true);

      const { data } = await supabase
        .from("events")
        .select(`
          id, title, description, event_date, event_time,
          location, venue, cover_image_url, category, fee_absorbed,
          ticket_batches (price, available_quantity)
        `)
        .eq("id", id)
        .maybeSingle();

      if (data) {
        const batches = (data as any).ticket_batches || [];
        const cheapest = batches.length > 0
          ? Math.min(...batches.map((b: any) => Number(b.price)))
          : 0;
        const totalAvailable = batches.reduce((sum: number, b: any) => sum + (b.available_quantity || 0), 0);

        setEvent({
          id: data.id,
          title: data.title,
          description: data.description || "",
          date: data.event_date,
          time: data.event_time,
          location: data.location,
          venue: data.venue,
          image: data.cover_image_url || "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
          price: cheapest,
          category: data.category,
          availableTickets: totalAvailable,
          organizer: "",
        });
      }
      setLoading(false);
    };

    fetchEvent();
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="container py-20 text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
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

  const formattedDate = new Date(event.date + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(event.price);

  return (
    <MainLayout>
      <div className="relative">
        <div className="aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 md:top-6 md:left-6 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors">
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      <div className="container -mt-16 relative z-10 pb-32 md:pb-8">
        <div className="hidden md:grid md:grid-cols-5 md:gap-8">
          <div className="md:col-span-3">
            <div className="bg-card rounded-2xl shadow-elevated p-6 md:p-8">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-4">
                {event.category}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{event.title}</h1>
              <div className="grid gap-3 mb-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="capitalize">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="h-5 w-5 flex-shrink-0" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 flex-shrink-0" />
                  <span>{event.venue}, {event.location}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Users className="h-5 w-5 flex-shrink-0" />
                  <span>{event.availableTickets.toLocaleString()} ingressos disponíveis</span>
                </div>
              </div>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-2">Sobre o evento</h2>
                <p className="text-muted-foreground leading-relaxed">{event.description}</p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <CheckoutPanel event={event} />
          </div>
        </div>

        <div className="md:hidden">
          <div className="bg-card rounded-2xl shadow-elevated p-5">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-4">
              {event.category}
            </span>
            <h1 className="text-2xl font-bold text-foreground mb-4">{event.title}</h1>
            <div className="grid gap-3 mb-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-5 w-5 flex-shrink-0" />
                <span className="capitalize">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 flex-shrink-0" />
                <span>{event.time}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="h-5 w-5 flex-shrink-0" />
                <span>{event.venue}, {event.location}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Users className="h-5 w-5 flex-shrink-0" />
                <span>{event.availableTickets.toLocaleString()} ingressos disponíveis</span>
              </div>
            </div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Sobre o evento</h2>
              <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur-lg border-t border-border z-50 md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">A partir de</p>
            <p className="text-xl font-bold text-foreground">{formattedPrice}</p>
          </div>
          <Button onClick={() => setDrawerOpen(true)} size="lg" variant="gradient">
            Comprar agora
          </Button>
        </div>
      </div>

      <CheckoutDrawer event={event} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </MainLayout>
  );
}
