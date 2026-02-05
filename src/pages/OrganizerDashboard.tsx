import { useState } from "react";
import { Plus, TrendingUp, Users, DollarSign, Calendar, MoreVertical, Eye, Edit, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { mockEvents } from "@/data/mockEvents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const stats = [
  { label: "Vendas totais", value: "R$ 12.450", icon: DollarSign, trend: "+12%" },
  { label: "Ingressos vendidos", value: "156", icon: TrendingUp, trend: "+8%" },
  { label: "Eventos ativos", value: "3", icon: Calendar, trend: "" },
  { label: "Visitantes", value: "2.4k", icon: Users, trend: "+23%" },
];

export default function OrganizerDashboard() {
  const [myEvents] = useState(mockEvents.slice(0, 3));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout>
      <div className="container py-6">
        {/* Header */}
        <section className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              Painel do Organizador
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus eventos e acompanhe as vendas
            </p>
          </div>
          <Button variant="gradient" className="hidden md:flex">
            <Plus className="h-5 w-5 mr-2" />
            Criar Evento
          </Button>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                {stat.trend && (
                  <span className="text-xs font-medium text-success px-2 py-1 bg-success/10 rounded-full">
                    {stat.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* My Events */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Meus Eventos</h2>
            <Button variant="ghost" size="sm">Ver todos</Button>
          </div>

          <div className="space-y-4">
            {myEvents.map((event) => (
              <div
                key={event.id}
                className="bg-card rounded-2xl shadow-card p-4 flex gap-4"
              >
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground line-clamp-1">
                      {event.title}
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-secondary rounded-lg transition-colors">
                          <MoreVertical className="h-5 w-5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {new Date(event.date).toLocaleDateString("pt-BR")} • {event.time}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">52</span> vendidos
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-primary">{formatCurrency(event.price * 52)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mobile FAB */}
        <Button
          variant="gradient"
          size="icon"
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-elevated md:hidden"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </MainLayout>
  );
}
