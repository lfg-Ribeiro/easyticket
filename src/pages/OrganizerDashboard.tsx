import { useState } from "react";
import { Plus, DollarSign, TrendingUp, UserCheck, Eye } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { mockEvents } from "@/data/mockEvents";
import { MetricCard } from "@/components/organizer/MetricCard";
import { SalesChart } from "@/components/organizer/SalesChart";
import { ParticipantsTable } from "@/components/organizer/ParticipantsTable";
import { CreateEventForm } from "@/components/organizer/CreateEventForm";
import { EventListItem } from "@/components/organizer/EventListItem";

const metrics = [
  {
    label: "Total de Vendas",
    value: "R$ 39.000",
    icon: DollarSign,
    trend: "+12%",
  },
  {
    label: "Ingressos Vendidos",
    value: "156",
    icon: TrendingUp,
    trend: "+8%",
  },
  {
    label: "Check-ins Realizados",
    value: "89",
    icon: UserCheck,
    trend: "",
    subtitle: "57% do total vendido",
  },
  {
    label: "Visualizações",
    value: "2.4k",
    icon: Eye,
    trend: "+23%",
  },
];

export default function OrganizerDashboard() {
  const [createOpen, setCreateOpen] = useState(false);
  const myEvents = mockEvents.slice(0, 3);

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
          <Button
            variant="gradient"
            className="hidden md:flex"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Criar Evento
          </Button>
        </section>

        {/* Metric Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <Button variant="ghost" size="sm">
              Ver todos
            </Button>
          </div>
          <div className="space-y-4">
            {myEvents.map((event) => (
              <EventListItem key={event.id} event={event} soldCount={52} />
            ))}
          </div>
        </section>

        {/* Mobile FAB */}
        <Button
          variant="gradient"
          size="icon"
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-elevated md:hidden z-40"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>

        {/* Create Event Modal */}
        <CreateEventForm open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </MainLayout>
  );
}
