import { Link } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";
import { Event } from "@/types/event";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  className?: string;
}

export function EventCard({ event, className }: EventCardProps) {
  const formattedDate = new Date(event.date).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(event.price);

  return (
    <Link to={`/event/${event.id}`} className={cn("block group", className)}>
      <article className="overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1">
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-background/90 backdrop-blur-sm text-foreground">
              {event.category}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-center gap-2 text-white/90 text-sm">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{formattedDate}</span>
              <span className="text-white/60">•</span>
              <span>{event.time}</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-foreground text-lg leading-tight mb-2 line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-3">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="line-clamp-1">{event.venue}, {event.location}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">A partir de</span>
            <span className="text-lg font-bold text-primary">{formattedPrice}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
