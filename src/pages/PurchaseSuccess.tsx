import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Check, Home, CalendarPlus, MapPin } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PremiumTicketCard } from "@/components/tickets/PremiumTicketCard";
import { WalletButton } from "@/components/tickets/WalletButton";
import { OfflineTip } from "@/components/tickets/OfflineTip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const eventId = searchParams.get("eventId") || "";
  const name = searchParams.get("name") || "Visitante";
  const email = searchParams.get("email") || "";
  const quantity = parseInt(searchParams.get("quantity") || "1", 10);
  const transactionId = searchParams.get("txn") || `TXN-${Date.now().toString(36).toUpperCase()}`;

  const [eventData, setEventData] = useState<{
    title: string; image: string; date: string; time: string; venue: string; location: string;
  } | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      const { data } = await supabase
        .from("events")
        .select("title, cover_image_url, event_date, event_time, venue, location")
        .eq("id", eventId)
        .maybeSingle();

      if (data) {
        setEventData({
          title: data.title,
          image: data.cover_image_url || "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
          date: data.event_date,
          time: data.event_time,
          venue: data.venue,
          location: data.location,
        });
      }
    };
    fetchEvent();
  }, [eventId]);

  const generateGoogleCalendarUrl = () => {
    if (!eventData) return "#";
    const dateStr = eventData.date.replace(/-/g, "");
    const timeStr = eventData.time.replace(/:/g, "").slice(0, 4);
    const startDateTime = `${dateStr}T${timeStr}00`;
    const endDate = new Date(`${eventData.date}T${eventData.time}`);
    endDate.setHours(endDate.getHours() + 3);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const endDateTime = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: eventData.title,
      dates: `${startDateTime}/${endDateTime}`,
      location: `${eventData.venue}, ${eventData.location}`,
      details: `Ingresso EasyTicket - ${transactionId}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const getDirectionsUrl = () => {
    if (!eventData) return "#";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventData.venue}, ${eventData.location}`)}`;
  };

  if (!eventData) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-16 text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-lg py-8 space-y-6">
        <div className="text-center space-y-3 animate-fade-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Compra Confirmada! 🎉</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            Seu ingresso foi enviado para{" "}
            <span className="font-semibold text-foreground">{email}</span>.
            Sua conta foi criada automaticamente — use seu e-mail para acessar seus ingressos.
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <PremiumTicketCard
            eventTitle={eventData.title}
            eventImage={eventData.image}
            eventDate={eventData.date}
            eventTime={eventData.time}
            eventVenue={eventData.venue}
            eventLocation={eventData.location}
            holderName={name}
            ticketType="Pista"
            quantity={quantity}
            transactionId={transactionId}
            qrCode={`TICKET-${transactionId.slice(-6)}`}
            status="valid"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <Button
            onClick={() => window.open(generateGoogleCalendarUrl(), "_blank")}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <CalendarPlus className="h-4 w-4" />
            Adicionar ao Calendário
          </Button>
          <Button
            onClick={() => window.open(getDirectionsUrl(), "_blank")}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <MapPin className="h-4 w-4" />
            Como Chegar
          </Button>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
          <WalletButton />
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
          <OfflineTip />
        </div>

        <div className="flex flex-col gap-3 pt-2 animate-fade-up" style={{ animationDelay: "400ms" }}>
          <Button onClick={() => navigate("/tickets")} variant="gradient" size="lg" className="w-full">
            Ver Meus Ingressos
          </Button>
          <Button onClick={() => navigate("/")} variant="ghost" size="lg" className="w-full gap-2">
            <Home className="h-4 w-4" />
            Explorar mais eventos
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
