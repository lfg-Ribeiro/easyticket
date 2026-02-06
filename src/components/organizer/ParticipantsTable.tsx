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
import { mockParticipants, Participant } from "@/data/mockOrganizerData";

const statusConfig: Record<Participant["paymentStatus"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  confirmado: { label: "Confirmado", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  reembolsado: { label: "Reembolsado", variant: "destructive" },
};

export function ParticipantsTable() {
  const handleExportCSV = () => {
    const headers = ["Nome", "E-mail", "Tipo de Ingresso", "Status", "Data da Compra"];
    const rows = mockParticipants.map((p) => [
      p.name,
      p.email,
      p.ticketType,
      statusConfig[p.paymentStatus].label,
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
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden md:table-cell">E-mail</TableHead>
            <TableHead>Ingresso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell text-right">Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockParticipants.map((participant) => {
            const status = statusConfig[participant.paymentStatus];
            return (
              <TableRow key={participant.id}>
                <TableCell className="font-medium text-foreground">
                  {participant.name}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {participant.email}
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
    </div>
  );
}
