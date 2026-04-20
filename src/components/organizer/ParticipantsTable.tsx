import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  id: string;
  name: string;
  email: string;
  ticketType: string;
  paymentStatus: string;
  purchaseDate: string;
  eventTitle: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  confirmed: { label: "Confirmado", variant: "default" },
  paid: { label: "Confirmado", variant: "default" },
  approved: { label: "Confirmado", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
  refunded: { label: "Reembolsado", variant: "destructive" },
};

export function ParticipantsTable() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParticipants = async () => {
      setLoading(true);
      try {
        const { data: tickets } = await supabase
          .from("tickets")
          .select(`
            id,
            holder_name,
            holder_email,
            created_at,
            check_in_status,
            order_id,
            event_id,
            batch_id
          `)
          .not("order_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(200);

        if (!tickets || tickets.length === 0) {
          setParticipants([]);
          return;
        }

        const orderIds = [...new Set(tickets.map(t => t.order_id))];
        const eventIds = [...new Set(tickets.map(t => t.event_id))];
        const batchIds = [...new Set(tickets.filter(t => t.batch_id).map(t => t.batch_id!))];

        const [ordersRes, eventsRes, batchesRes] = await Promise.all([
          supabase.from("orders").select("id, payment_status").in("id", orderIds),
          supabase.from("events").select("id, title").in("id", eventIds),
          batchIds.length > 0
            ? supabase.from("ticket_batches").select("id, name").in("id", batchIds)
            : Promise.resolve({ data: [] }),
        ]);

        const ordersMap = new Map((ordersRes.data || []).map(o => [o.id, o]));
        const eventsMap = new Map((eventsRes.data || []).map(e => [e.id, e]));
        const batchesMap = new Map((batchesRes.data || []).map(b => [b.id, b]));

        // Only show tickets that have a matching order (drops phantom test data)
        const validTickets = tickets.filter(t => ordersMap.has(t.order_id));

        setParticipants(
          validTickets.slice(0, 100).map(t => {
            const order = ordersMap.get(t.order_id)!;
            return {
              id: t.id,
              name: t.holder_name,
              email: t.holder_email,
              ticketType: t.batch_id ? (batchesMap.get(t.batch_id)?.name || "Ingresso") : "Ingresso",
              paymentStatus: order.payment_status,
              purchaseDate: t.created_at,
              eventTitle: eventsMap.get(t.event_id)?.title || "",
            };
          })
        );
      } catch (err) {
        console.error("Participants fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, []);

  const handleExportCSV = () => {
    const headers = ["Nome", "E-mail", "Evento", "Tipo de Ingresso", "Status", "Data da Compra"];
    const rows = participants.map((p) => [
      p.name,
      p.email,
      p.eventTitle,
      p.ticketType,
      statusConfig[p.paymentStatus]?.label || p.paymentStatus,
      new Date(p.purchaseDate).toLocaleDateString("pt-BR"),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "participantes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-5 md:p-6">
        <h2 className="text-lg font-bold text-foreground">Participantes</h2>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={participants.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando participantes...</div>
      ) : participants.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nenhum participante encontrado</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead className="hidden lg:table-cell">Evento</TableHead>
              <TableHead>Ingresso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((participant) => {
              const status = statusConfig[participant.paymentStatus] || { label: participant.paymentStatus, variant: "secondary" as const };
              return (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium text-foreground">
                    {participant.name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {participant.email}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {participant.eventTitle}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{participant.ticketType}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                    {new Date(participant.purchaseDate).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
