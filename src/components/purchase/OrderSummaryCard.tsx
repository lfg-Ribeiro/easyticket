import { CalendarDays, CreditCard, MapPin, Ticket, User } from "lucide-react";
import { formatBRL } from "@/lib/purchase";
import { formatEventDate } from "@/lib/utils";

export interface PurchaseEventInfo {
  title: string;
  image: string;
  date: string;
  time: string;
  venue: string;
  location: string;
}

interface OrderSummaryCardProps {
  event: PurchaseEventInfo;
  quantity: number;
  batchName?: string;
  buyerName?: string;
  buyerEmail?: string;
  total: number | null;
  /** true: "Total pago"; false: pagamento ainda em confirmação ("Total"). */
  paid: boolean;
}

function Row({ icon: Icon, label, children }: { icon: typeof Ticket; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="text-sm font-semibold text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** Resumo do pedido: evento, data/hora, local, ingressos, comprador e total. */
export function OrderSummaryCard({ event, quantity, batchName, buyerName, buyerEmail, total, paid }: OrderSummaryCardProps) {
  const date = formatEventDate(event.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = event.time ? event.time.slice(0, 5) : "";
  const place = [event.venue, event.location].filter(Boolean).join(", ");

  return (
    <section aria-label="Resumo do pedido" className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="relative h-32 overflow-hidden">
        <img src={event.image} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
        <h2 className="absolute bottom-3 left-4 right-4 line-clamp-2 text-lg font-bold leading-tight text-card drop-shadow">
          {event.title}
        </h2>
      </div>

      <dl className="space-y-4 p-5">
        <Row icon={CalendarDays} label="Data e horário">
          <span className="capitalize">{date}</span>
          {time && <> • {time}</>}
        </Row>
        {place && (
          <Row icon={MapPin} label="Local">
            {place}
          </Row>
        )}
        <Row icon={Ticket} label="Ingressos">
          {quantity} {quantity === 1 ? "ingresso" : "ingressos"}
          {batchName && <span className="font-normal text-muted-foreground"> • {batchName}</span>}
        </Row>
        {(buyerName || buyerEmail) && (
          <Row icon={User} label="Comprador">
            {buyerName && <span className="block truncate">{buyerName}</span>}
            {buyerEmail && <span className="block truncate font-normal text-muted-foreground">{buyerEmail}</span>}
          </Row>
        )}
        {total !== null && (
          <div className="flex items-center justify-between border-t border-dashed border-border pt-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {paid ? "Total pago" : "Total"}
            </span>
            <span className="text-lg font-bold text-foreground">{formatBRL(total)}</span>
          </div>
        )}
      </dl>
    </section>
  );
}
