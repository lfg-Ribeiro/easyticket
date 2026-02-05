import { QrCode, Calendar, MapPin, Check, Clock } from "lucide-react";
import { Ticket } from "@/types/event";
import { cn } from "@/lib/utils";

interface TicketCardProps {
  ticket: Ticket;
  className?: string;
}

export function TicketCard({ ticket, className }: TicketCardProps) {
  const formattedDate = new Date(ticket.event.date).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const statusConfig = {
    valid: { label: "Válido", color: "bg-success text-success-foreground" },
    used: { label: "Utilizado", color: "bg-muted text-muted-foreground" },
    expired: { label: "Expirado", color: "bg-destructive/10 text-destructive" },
  };

  const status = statusConfig[ticket.status];

  return (
    <article className={cn("bg-card rounded-2xl shadow-card overflow-hidden", className)}>
      <div className="relative h-32 overflow-hidden">
        <img
          src={ticket.event.image}
          alt={ticket.event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white font-bold text-lg leading-tight line-clamp-1">
            {ticket.event.title}
          </h3>
        </div>
        <div className="absolute top-3 right-3">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", status.color)}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{ticket.event.time}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span className="line-clamp-1">{ticket.event.venue}</span>
        </div>

        <div className="border-t border-dashed border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Quantidade</p>
              <p className="font-semibold">{ticket.quantity} ingresso{ticket.quantity > 1 ? 's' : ''}</p>
            </div>
            <div className="w-20 h-20 bg-secondary rounded-xl flex items-center justify-center">
              <QrCode className="h-12 w-12 text-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Código: {ticket.qrCode}
          </p>
        </div>
      </div>
    </article>
  );
}
