import { QrCode, Calendar, MapPin, Clock, Smartphone, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumTicketCardProps {
  eventTitle: string;
  eventImage: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventLocation: string;
  holderName: string;
  ticketType: string;
  quantity: number;
  transactionId: string;
  qrCode: string;
  status: "valid" | "used" | "expired";
  className?: string;
}

export function PremiumTicketCard({
  eventTitle,
  eventImage,
  eventDate,
  eventTime,
  eventVenue,
  eventLocation,
  holderName,
  ticketType,
  quantity,
  transactionId,
  qrCode,
  status,
  className,
}: PremiumTicketCardProps) {
  const formattedDate = new Date(eventDate).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statusConfig = {
    valid: { label: "Disponível", bgClass: "bg-success/10", textClass: "text-success", dotClass: "bg-success" },
    used: { label: "Utilizado", bgClass: "bg-muted", textClass: "text-muted-foreground", dotClass: "bg-muted-foreground" },
    expired: { label: "Expirado", bgClass: "bg-destructive/10", textClass: "text-destructive", dotClass: "bg-destructive" },
  };

  const s = statusConfig[status];

  return (
    <article
      className={cn(
        "bg-card rounded-3xl shadow-elevated overflow-hidden max-w-md mx-auto w-full",
        className
      )}
    >
      {/* Event Image Header */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={eventImage}
          alt={eventTitle}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5">
          <h2 className="text-2xl font-bold text-card leading-tight line-clamp-2 drop-shadow-lg">
            {eventTitle}
          </h2>
        </div>
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm",
              s.bgClass,
              s.textClass
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", s.dotClass)} />
            {s.label}
          </span>
        </div>
      </div>

      {/* Event Info Section */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2.5">
            <Calendar className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Data</p>
              <p className="text-sm font-semibold text-foreground capitalize">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Horário</p>
              <p className="text-sm font-semibold text-foreground">{eventTime}</p>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Local</p>
            <p className="text-sm font-semibold text-foreground">{eventVenue}, {eventLocation}</p>
          </div>
        </div>
      </div>

      {/* Dashed Cut Line */}
      <div className="relative flex items-center mx-0 my-1">
        <div className="absolute -left-4 w-8 h-8 rounded-full bg-background" />
        <div className="flex-1 border-t-2 border-dashed border-border mx-6" />
        <Scissors className="h-4 w-4 text-muted-foreground/40 mx-1 rotate-180" />
        <div className="flex-1 border-t-2 border-dashed border-border mx-6" />
        <div className="absolute -right-4 w-8 h-8 rounded-full bg-background" />
      </div>

      {/* Ticket Details + QR */}
      <div className="px-5 pt-4 pb-5">
        <div className="flex gap-4 items-start">
          {/* Left: Holder Info */}
          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Titular</p>
              <p className="text-sm font-bold text-foreground truncate">{holderName}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Tipo</p>
                <p className="text-sm font-semibold text-foreground">{ticketType}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Qtd</p>
                <p className="text-sm font-semibold text-foreground">{quantity}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">ID Transação</p>
              <p className="text-xs font-mono text-muted-foreground">{transactionId}</p>
            </div>
          </div>

          {/* Right: QR Code */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-foreground rounded-xl flex items-center justify-center p-1.5">
              <div className="grid grid-cols-8 gap-px w-full h-full">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-[1px]",
                      // Deterministic pattern based on qrCode string
                      (qrCode.charCodeAt(i % qrCode.length) + i) % 3 !== 0
                        ? "bg-background"
                        : "bg-foreground"
                    )}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">{qrCode}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
