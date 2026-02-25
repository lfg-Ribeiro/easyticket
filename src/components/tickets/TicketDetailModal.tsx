import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, Clock, MapPin, Send, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Ticket } from "@/types/event";

interface TicketDetailModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred?: () => void;
}

export function TicketDetailModal({ ticket, open, onOpenChange, onTransferred }: TicketDetailModalProps) {
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferCpf, setTransferCpf] = useState("");
  const [transferring, setTransferring] = useState(false);

  if (!ticket) return null;

  const statusConfig = {
    valid: { label: "Disponível", bgClass: "bg-success/10", textClass: "text-success", dotClass: "bg-success" },
    used: { label: "Utilizado", bgClass: "bg-muted", textClass: "text-muted-foreground", dotClass: "bg-muted-foreground" },
    expired: { label: "Expirado", bgClass: "bg-destructive/10", textClass: "text-destructive", dotClass: "bg-destructive" },
  };
  const status = statusConfig[ticket.status];

  const formattedDate = new Date(ticket.event.date).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const handleTransfer = async () => {
    const rawCpf = transferCpf.replace(/\D/g, "");
    if (rawCpf.length !== 11) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }

    setTransferring(true);
    try {
      const { data, error } = await supabase.rpc("transfer_ticket", {
        p_ticket_id: ticket.id,
        p_new_cpf: transferCpf,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.error) {
        toast({ title: result.error, variant: "destructive" });
      } else {
        toast({ title: `Ingresso transferido para ${result.new_holder || "novo titular"}! 🎉` });
        setShowTransfer(false);
        setTransferCpf("");
        onOpenChange(false);
        onTransferred?.();
      }
    } catch (err: any) {
      toast({ title: "Erro ao transferir ingresso", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setShowTransfer(false); setTransferCpf(""); } }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header Image */}
        <div className="relative h-40 overflow-hidden">
          <img
            src={ticket.event.image}
            alt={ticket.event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-lg font-bold text-foreground line-clamp-2">{ticket.event.title}</h2>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status Badge */}
          <div className="flex justify-center">
            <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", status.bgClass, status.textClass)}>
              <span className={cn("w-2 h-2 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className={cn(
              "p-4 bg-white rounded-2xl shadow-card",
              ticket.status !== "valid" && "opacity-30 blur-sm"
            )}>
              <QRCodeSVG value={ticket.qrCode} size={200} level="H" />
            </div>
          </div>

          {/* Event Details */}
          <div className="space-y-2.5 bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{ticket.event.time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{ticket.event.venue} — {ticket.event.location}</span>
            </div>
          </div>

          {/* Transfer Section */}
          {ticket.status === "valid" && !showTransfer && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowTransfer(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Transferir Ingresso
            </Button>
          )}

          {showTransfer && (
            <div className="space-y-3 p-4 border border-border rounded-xl animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">Transferir para</h3>
                <button onClick={() => setShowTransfer(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <Label htmlFor="transfer-cpf" className="text-xs">CPF do novo titular</Label>
                <Input
                  id="transfer-cpf"
                  value={transferCpf}
                  onChange={(e) => setTransferCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-1"
                  maxLength={14}
                />
              </div>
              <Button
                onClick={handleTransfer}
                disabled={transferring || transferCpf.replace(/\D/g, "").length !== 11}
                className="w-full"
              >
                {transferring ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
