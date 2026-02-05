import { MainLayout } from "@/components/layout/MainLayout";
import { TicketCard } from "@/components/tickets/TicketCard";
import { mockTickets } from "@/data/mockEvents";
import { Ticket } from "lucide-react";

export default function MyTickets() {
  return (
    <MainLayout>
      <div className="container py-6">
        {/* Header */}
        <section className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Meus Ingressos
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus ingressos e acesse os QR Codes
          </p>
        </section>

        {/* Tickets List */}
        {mockTickets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 stagger-children">
            {mockTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Nenhum ingresso
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Você ainda não comprou nenhum ingresso. Explore os eventos disponíveis e garanta já o seu!
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
