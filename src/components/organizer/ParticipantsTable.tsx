import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  id: string;
  name: string;
  email: string;
  event_title: string;
  event_id: string;
  ticket_type: string;
  status: string;
  date: string;
}

interface ParticipantsTableProps {
  events?: { id: string; title: string }[];
}

export function ParticipantsTable({ events = [] }: ParticipantsTableProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    async function fetchParticipantsData() {
      setLoading(true);
      try {
        // Busca tickets, eventos e lotes separadamente para garantir estabilidade total
        const [ticketsRes, eventsRes, batchesRes] = await Promise.all([
          supabase.from("tickets").select("*").order("created_at", { ascending: false }),
          supabase.from("events").select("id, title"),
          supabase.from("ticket_batches").select("id, name")
        ]);

        const tickets = ticketsRes.data || [];
        const eventsList = eventsRes.data || [];
        const batchesList = batchesRes.data || [];

        const eventMap = new Map(eventsList.map((e) => [e.id, e.title]));
        const batchMap = new Map(batchesList.map((b) => [b.id, b.name]));

        const formatted: Participant[] = tickets.map((t: any) => {
          const evId = t.event_id;
          const batchId = t.batch_id || t.ticket_batch_id;
          
          return {
            id: t.id,
            name: t.holder_name || t.holder_email || "Convidado",
            email: t.holder_email || "N/A",
            event_title: evId ? (eventMap.get(evId) || "Evento") : "Evento",
            event_id: evId || "",
            ticket_type: batchId ? (batchMap.get(batchId) || "Ingresso") : "Ingresso",
            status: t.status === "used" ? "Utilizado" : "Confirmado",
            date: new Date(t.created_at).toLocaleDateString("pt-BR"),
          };
        });

        setParticipants(formatted);
      } catch (err) {
        console.error("Erro ao carregar participantes:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchParticipantsData();
  }, []);

  // Filtragem por busca (nome/e-mail) e evento selecionado
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesEvent =
        selectedEventId === "all" || p.event_id === selectedEventId;

      return matchesSearch && matchesEvent;
    });
  }, [participants, search, selectedEventId]);

  // Paginação
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredParticipants.slice(start, start + itemsPerPage);
  }, [filteredParticipants, currentPage]);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground">Participantes</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Barra de Busca */}
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-xs"
          />

          {/* Filtro Rápido por Evento */}
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filtrar por evento"
            className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
          >
            <option value="all">Todos os Eventos</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando participantes...</div>
      ) : paginatedParticipants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-3 px-4 font-medium">Nome</th>
                <th className="py-3 px-4 font-medium">E-mail</th>
                <th className="py-3 px-4 font-medium">Evento</th>
                <th className="py-3 px-4 font-medium">Ingresso</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedParticipants.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{p.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.email}</td>
                  <td className="py-3 px-4 text-foreground">{p.event_title}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.ticket_type}</td>
                  <td className="py-3 px-4">
                    <Badge variant={p.status === "Utilizado" ? "outline" : "default"}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">Nenhum participante encontrado.</div>
      )}

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between pt-4 border-t border-border gap-2">
          <p className="text-sm text-muted-foreground">
            Mostrando página {currentPage} de {totalPages} ({filteredParticipants.length} no total)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              Anterior
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}