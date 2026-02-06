import { MainLayout } from "@/components/layout/MainLayout";
import { TicketCard } from "@/components/tickets/TicketCard";
import { mockTickets } from "@/data/mockEvents";
import { Ticket } from "lucide-react";

export default function MyTickets() {
  const validTickets = mockTickets.filter((t) => t.status === "valid");
  const pastTickets = mockTickets.filter((t) => t.status !== "valid");

  return (
    <MainLayout>
      <div className="container max-w-2xl py-6">
        {/* Header */}
        <section className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Meus Ingressos
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus ingressos e acesse os QR Codes
          </p>
        </section>

        {mockTickets.length > 0 ? (
          <div className="space-y-8">
            {/* Valid Tickets */}
            {validTickets.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Próximos eventos
                </h2>
                <div className="space-y-3 stagger-children">
                  {validTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              </section>
            )}

            {/* Past Tickets */}
            {pastTickets.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Histórico
                </h2>
                <div className="space-y-3 stagger-children">
                  {pastTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              </section>
            )}
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
