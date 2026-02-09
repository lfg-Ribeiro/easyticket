import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TicketCard } from "@/components/tickets/TicketCard";
import { Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Ticket as TicketType } from "@/types/event";

export default function MyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("tickets")
        .select(`
          id, qr_code, check_in_status, holder_name, created_at,
          order:orders!tickets_order_id_fkey (quantity, total_amount),
          event:events!tickets_event_id_fkey (
            id, title, description, event_date, event_time,
            location, venue, cover_image_url, category
          )
        `)
        .eq("holder_email", user.email)
        .order("created_at", { ascending: false });

      if (data) {
        const mapped: TicketType[] = data.map((t: any) => ({
          id: t.id,
          eventId: t.event?.id || "",
          event: {
            id: t.event?.id || "",
            title: t.event?.title || "",
            description: t.event?.description || "",
            date: t.event?.event_date || "",
            time: t.event?.event_time || "",
            location: t.event?.location || "",
            venue: t.event?.venue || "",
            image: t.event?.cover_image_url || "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
            price: 0,
            category: t.event?.category || "",
            availableTickets: 0,
            organizer: "",
          },
          quantity: t.order?.quantity || 1,
          totalPrice: t.order?.total_amount || 0,
          purchaseDate: t.created_at,
          qrCode: t.qr_code,
          status: t.check_in_status === "valid" ? "valid" as const
            : t.check_in_status === "used" ? "used" as const
            : "expired" as const,
        }));
        setTickets(mapped);
      }
      setLoading(false);
    };

    fetchTickets();
  }, [user]);

  const validTickets = tickets.filter((t) => t.status === "valid");
  const pastTickets = tickets.filter((t) => t.status !== "valid");

  return (
    <MainLayout>
      <div className="container max-w-2xl py-6">
        <section className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Meus Ingressos</h1>
          <p className="text-muted-foreground">Gerencie seus ingressos e acesse os QR Codes</p>
        </section>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-card rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="space-y-8">
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
            <h2 className="text-lg font-semibold text-foreground mb-2">Nenhum ingresso</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {user
                ? "Você ainda não comprou nenhum ingresso. Explore os eventos disponíveis e garanta já o seu!"
                : "Faça login para ver seus ingressos."}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
