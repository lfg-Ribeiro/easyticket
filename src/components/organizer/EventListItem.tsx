import { MoreVertical, Eye, Copy, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BatchManager } from "@/components/organizer/BatchManager";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface EventListItemProps {
  event: {
    id: string;
    title: string;
    date: string;
    time: string;
    image: string;
    published?: boolean;
  };
  soldCount: number;
  revenue: number;
  onEdit?: (eventId: string) => void;
  /** When false, the card is read-only: no edit button and no lot switches. */
  canManage?: boolean;
}

export function EventListItem({ event, soldCount, revenue, onEdit, canManage = false }: EventListItemProps) {
  const navigate = useNavigate();

  const formattedRevenue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(revenue);

  const handleCopyLink = () => {
    const url = `https://www.easyticket.dev.br/event/${event.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "URL do evento copiada para a área de transferência." });
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-4 flex gap-4">
      <img
        src={event.image}
        alt={event.title}
        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-1">
              {event.title}
            </h3>
            {event.published === false && (
              <span className="inline-block mt-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Pausado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit?.(event.id)}
              aria-label={`Editar ${event.title}`}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-secondary rounded-lg transition-colors">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/event/${event.id}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(event.id)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          {new Date(event.date).toLocaleDateString("pt-BR")} • {event.time}
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{soldCount}</span> vendidos
          </span>
          <span className="font-semibold text-primary">{formattedRevenue}</span>
        </div>
        <BatchManager eventId={event.id} />

      </div>
    </div>
  );
}
