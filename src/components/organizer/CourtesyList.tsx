import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Gift, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { courtesyStatusLabel, visibleProducerCourtesies, type CourtesyTicket } from "@/lib/courtesy";

interface CourtesyListProps {
  events: { id: string; title: string }[];
  /** Muda quando uma nova cortesia é emitida, para recarregar a lista. */
  refreshKey?: number;
}

/**
 * Aba/seção "Cortesias" do produtor: lista SOMENTE courtesy_type = 'organizer'.
 * As cortesias 'admin' (donos da plataforma) nunca aparecem aqui nem no contador.
 */
export function CourtesyList({ events, refreshKey = 0 }: CourtesyListProps) {
  const [tickets, setTickets] = useState<CourtesyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("all");
  const [toRevoke, setToRevoke] = useState<CourtesyTicket | null>(null);
  const [revoking, setRevoking] = useState(false);

  const eventTitles = useMemo(() => new Map(events.map((event) => [event.id, event.title])), [events]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("id, event_id, qr_code, guest_name, guest_email, guest_cpf, check_in_status, courtesy_type, is_complimentary, created_at")
      .eq("is_complimentary", true)
      .eq("courtesy_type", "organizer")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Não foi possível carregar as cortesias", variant: "destructive" });
      setTickets([]);
    } else {
      setTickets(visibleProducerCourtesies((data ?? []) as CourtesyTicket[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const visible = useMemo(
    () =>
      tickets.filter(
        (ticket) => eventTitles.has(ticket.event_id) && (eventFilter === "all" || ticket.event_id === eventFilter),
      ),
    [tickets, eventTitles, eventFilter],
  );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Código copiado!" });
    } catch {
      toast({ title: "Não foi possível copiar o código", description: code, variant: "destructive" });
    }
  };

  const revoke = async () => {
    if (!toRevoke) return;
    setRevoking(true);
    const { data, error } = await supabase
      .from("tickets")
      .delete()
      .eq("id", toRevoke.id)
      .eq("courtesy_type", "organizer")
      .select("id");
    setRevoking(false);

    if (error || !data?.length) {
      toast({
        title: "Não foi possível revogar a cortesia",
        description: "Ela pode já ter sido utilizada na portaria.",
        variant: "destructive",
      });
    } else {
      setTickets((prev) => prev.filter((ticket) => ticket.id !== toRevoke.id));
      toast({ title: "Cortesia revogada", description: "O QR Code deixou de funcionar." });
    }
    setToRevoke(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? (
            <Skeleton className="inline-block h-4 w-24 align-middle" />
          ) : (
            <>
              <span className="font-semibold text-foreground">{visible.length}</span>{" "}
              {visible.length === 1 ? "cortesia emitida" : "cortesias emitidas"}
            </>
          )}
        </p>
        <select
          aria-label="Filtrar cortesias por evento"
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos os eventos</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-busy="true">
          <span className="sr-only">Carregando cortesias…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} aria-hidden="true" className="h-12 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-secondary py-10 text-center">
          <Gift className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Nenhuma cortesia emitida ainda</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 font-medium">Convidado</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((ticket) => {
                const used = ticket.check_in_status === "used";
                const name = ticket.guest_name || "Convidado";
                return (
                  <tr key={ticket.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ticket.guest_email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ticket.guest_cpf || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{eventTitles.get(ticket.event_id)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={used ? "secondary" : "default"}>{courtesyStatusLabel(ticket.check_in_status)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Copiar código de ${name}`}
                          onClick={() => copyCode(ticket.qr_code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!used && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Revogar cortesia de ${name}`}
                            onClick={() => setToRevoke(ticket)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!toRevoke} onOpenChange={(open) => !open && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar cortesia?</AlertDialogTitle>
            <AlertDialogDescription>
              O ingresso de {toRevoke?.guest_name || "convidado"} será cancelado e o QR Code deixará de funcionar na
              portaria. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoking}
              onClick={(e) => {
                e.preventDefault();
                revoke();
              }}
            >
              {revoking ? "Revogando…" : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
