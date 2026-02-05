import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Minus, Plus, Share2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { mockEvents } from "@/data/mockEvents";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const event = mockEvents.find((e) => e.id === id);

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

  const formattedDate = new Date(event.date).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(event.price);

  const totalPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(event.price * quantity);

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(10, prev + delta)));
  };

  const handleBuyNow = () => {
    navigate(`/checkout/${event.id}?quantity=${quantity}`);
  };

  return (
    <MainLayout>
      {/* Header Image */}
      <div className="relative">
        <div className="aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 md:top-6 md:left-6 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Share button */}
        <button
          className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      <div className="container -mt-16 relative z-10 pb-32 md:pb-8">
        <div className="bg-card rounded-2xl shadow-elevated p-5 md:p-8">
          {/* Category badge */}
          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-4">
            {event.category}
          </span>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            {event.title}
          </h1>

          {/* Event Info */}
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

          {/* Description */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-2">Sobre o evento</h2>
            <p className="text-muted-foreground leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Organizer */}
          <div className="mb-8 p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Organizado por</p>
            <p className="font-semibold text-foreground">{event.organizer}</p>
          </div>

          {/* Ticket Selection - Desktop */}
          <div className="hidden md:block border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Preço por ingresso</p>
                <p className="text-2xl font-bold text-foreground">{formattedPrice}</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= 10}
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <Button onClick={handleBuyNow} size="xl" variant="gradient">
                  Comprar • {totalPrice}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur-lg border-t border-border md:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-50"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-lg font-semibold w-6 text-center">{quantity}</span>
            <button
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= 10}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-foreground">{totalPrice}</p>
          </div>
        </div>
        <Button onClick={handleBuyNow} className="w-full" size="lg" variant="gradient">
          Comprar agora
        </Button>
      </div>
    </MainLayout>
  );
}
