import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, DollarSign, TrendingUp, UserCheck, Eye, QrCode, Percent, Wallet } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/organizer/MetricCard";
import { SalesChart } from "@/components/organizer/SalesChart";
import { ParticipantsTable } from "@/components/organizer/ParticipantsTable";
import { CreateEventForm } from "@/components/organizer/CreateEventForm";
import { EventListItem } from "@/components/organizer/EventListItem";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DBEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  location: string;
  venue: string;
  cover_image_url: string | null;
  category: string;
  published: boolean;
}

interface EventStats {
  [eventId: string]: { sold: number; revenue: number };
}

export default function OrganizerDashboard() {
  const navigate = useNavigate();
  const { user, session, isOrganizer } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [myEvents, setMyEvents] = useState<DBEvent[]>([]);
  const [eventStats, setEventStats] = useState<EventStats>({});
  const [totalSales, setTotalSales] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [ticketsSold, setTicketsSold] = useState(0);
  const [checkIns, setCheckIns] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    try {
      // Fetch metrics from edge function (bypasses RLS via service role)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-dashboard-metrics`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const metrics = await res.json();
      console.log("Dashboard metrics response:", metrics);

      if (res.ok) {
        setTotalSales(metrics.total_revenue || 0);
        setTotalFees(metrics.total_fees || 0);
        setTicketsSold(metrics.total_tickets || 0);
        setCheckIns(metrics.total_checkins || 0);
        setTotalEvents(metrics.total_events || 0);
      } else {
        console.error("Dashboard metrics error:", metrics);
      }

      // Fetch events list (for display)
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      setMyEvents((events as DBEvent[]) || []);

      // Fetch per-event stats (sold count + organizer revenue from confirmed orders, subtotal only)
      if (events && events.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("event_id, quantity, subtotal, total_amount, platform_fee, service_fee, payment_status")
          .in("payment_status", ["confirmed", "paid"]);

        const stats: EventStats = {};
        (orders || []).forEach((o: any) => {
          if (!stats[o.event_id]) stats[o.event_id] = { sold: 0, revenue: 0 };
          stats[o.event_id].sold += o.quantity;
          const fee = Number(o.platform_fee ?? o.service_fee ?? 0);
          const sub = o.subtotal != null ? Number(o.subtotal) : Number(o.total_amount) - fee;
          stats[o.event_id].revenue += sub;
        });
        setEventStats(stats);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Removed auto-assign organizer role - now managed by RBAC

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const checkInPercent = ticketsSold > 0
    ? `${Math.round((checkIns / ticketsSold) * 100)}% do total vendido`
    : "0% do total vendido";

  const netReceivable = totalSales - totalFees;

  const metrics = [
    { label: "Total Bruto", value: formatCurrency(totalSales), icon: DollarSign, trend: "" },
    { label: "Taxas da Plataforma (5%)", value: formatCurrency(totalFees), icon: Percent, trend: "" },
    { label: "Líquido a Receber", value: formatCurrency(netReceivable), icon: Wallet, trend: "" },
    { label: "Ingressos Vendidos", value: String(ticketsSold), icon: TrendingUp, trend: "" },
    { label: "Check-ins Realizados", value: String(checkIns), icon: UserCheck, trend: "", subtitle: checkInPercent },
    { label: "Meus Eventos", value: String(totalEvents), icon: Eye, trend: "" },
  ];

  // Map DB events to the EventListItem format
  const eventListItems = myEvents.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.event_time,
    image: e.cover_image_url || "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=500&fit=crop",
  }));

  return (
    <MainLayout>
      <div className="container py-6 space-y-8">
        {/* Header */}
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              Painel do Organizador
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus eventos e acompanhe as vendas
            </p>
          </div>
          <div className="hidden md:flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/organizer/scan")}
            >
              <QrCode className="h-5 w-5 mr-2" />
              Scanner
            </Button>
            <Button
              variant="gradient"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-5 w-5 mr-2" />
              Criar Evento
            </Button>
          </div>
        </section>

        {/* Metric Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        {/* Sales Chart */}
        <section>
          <SalesChart />
        </section>

        {/* Participants Table */}
        <section>
          <ParticipantsTable />
        </section>

        {/* My Events */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Meus Eventos</h2>
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : eventListItems.length > 0 ? (
            <div className="space-y-4">
              {eventListItems.map((event) => (
                <EventListItem
                  key={event.id}
                  event={event}
                  soldCount={eventStats[event.id]?.sold || 0}
                  revenue={eventStats[event.id]?.revenue || 0}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-secondary rounded-2xl">
              <p className="text-muted-foreground mb-3">Nenhum evento criado ainda</p>
              <Button variant="gradient" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Evento
              </Button>
            </div>
          )}
        </section>

        {/* Mobile FABs */}
        <div className="fixed bottom-20 right-4 flex flex-col gap-3 md:hidden z-40">
          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full shadow-elevated bg-background"
            onClick={() => navigate("/organizer/scan")}
          >
            <QrCode className="h-5 w-5" />
          </Button>
          <Button
            variant="gradient"
            size="icon"
            className="w-14 h-14 rounded-full shadow-elevated"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        {/* Create Event Modal */}
        <CreateEventForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          onEventCreated={fetchDashboardData}
        />
      </div>
    </MainLayout>
  );
}
