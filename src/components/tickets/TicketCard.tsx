import { QrCode, Calendar, MapPin, Clock, Scissors, ChevronRight } from "lucide-react";
import { Ticket } from "@/types/event";
import { cn, formatEventDate } from "@/lib/utils";

interface TicketCardProps {
  ticket: Ticket;
  className?: string;
}

export function TicketCard({ ticket, className }: TicketCardProps) {
  const formattedDate = formatEventDate(ticket.event.date, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const statusConfig = {
    valid: { label: "Disponível", bgClass: "bg-success/10", textClass: "text-success", dotClass: "bg-success" },
    used: { label: "Utilizado", bgClass: "bg-muted", textClass: "text-muted-foreground", dotClass: "bg-muted-foreground" },
    expired: { label: "Expirado", bgClass: "bg-destructive/10", textClass: "text-destructive", dotClass: "bg-destructive" },
  };

  const status = statusConfig[ticket.status];

  return (
    <article
      className={cn(
        "bg-card rounded-2xl shadow-card overflow-hidden flex flex-row h-36 hover:shadow-elevated transition-shadow cursor-pointer group",
        className
      )}
    >
      {/* Left: Event Image */}
      <div className="relative w-32 flex-shrink-0 overflow-hidden">
        <img
          src={ticket.event.image}
          alt={ticket.event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-foreground/5" />
      </div>

      {/* Dashed vertical separator with cutouts */}
      <div className="relative flex flex-col items-center justify-center w-0">
        <div className="absolute -top-4 w-8 h-8 rounded-full bg-background z-10" />
        <div className="h-full border-l-2 border-dashed border-border" />
        <div className="absolute -bottom-4 w-8 h-8 rounded-full bg-background z-10" />
      </div>

      {/* Right: Info */}
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2 flex-1">
              {ticket.event.title}
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0",
                status.bgClass,
                status.textClass
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mt-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{ticket.event.time}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{ticket.event.venue}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            {ticket.quantity} ingresso{ticket.quantity > 1 ? "s" : ""}
          </p>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </article>
  );
}