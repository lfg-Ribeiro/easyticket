import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, ArrowLeft, Home } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PremiumTicketCard } from "@/components/tickets/PremiumTicketCard";
import { WalletButton } from "@/components/tickets/WalletButton";
import { OfflineTip } from "@/components/tickets/OfflineTip";
import { Button } from "@/components/ui/button";
import { mockEvents } from "@/data/mockEvents";

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const eventId = searchParams.get("eventId") || "1";
  const name = searchParams.get("name") || "Visitante";
  const email = searchParams.get("email") || "";
  const quantity = parseInt(searchParams.get("quantity") || "1", 10);
  const transactionId = searchParams.get("txn") || `TXN-${Date.now().toString(36).toUpperCase()}`;

  const event = mockEvents.find((e) => e.id === eventId) || mockEvents[0];

  return (
    <MainLayout>
      <div className="container max-w-lg py-8 space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-3 animate-fade-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Compra Confirmada! 🎉
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            Seu ingresso foi enviado para{" "}
            <span className="font-semibold text-foreground">{email}</span>.
            Sua conta foi criada automaticamente — use seu e-mail para acessar seus ingressos.
          </p>
        </div>

        {/* Premium Ticket */}
        <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <PremiumTicketCard
            eventTitle={event.title}
            eventImage={event.image}
            eventDate={event.date}
            eventTime={event.time}
            eventVenue={event.venue}
            eventLocation={event.location}
            holderName={name}
            ticketType="Pista"
            quantity={quantity}
            transactionId={transactionId}
            qrCode={`TICKET-${transactionId.slice(-6)}`}
            status="valid"
          />
        </div>

        {/* Wallet Button */}
        <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <WalletButton />
        </div>

        {/* Offline Tip */}
        <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
          <OfflineTip />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2 animate-fade-up" style={{ animationDelay: "400ms" }}>
          <Button
            onClick={() => navigate("/tickets")}
            variant="gradient"
            size="lg"
            className="w-full"
          >
            Ver Meus Ingressos
          </Button>
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="lg"
            className="w-full gap-2"
          >
            <Home className="h-4 w-4" />
            Explorar mais eventos
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
