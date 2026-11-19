import { useEffect, useState } from "react";
import { CourtesyFormDialog, type CourtesyEventOption } from "@/components/organizer/CourtesyFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AdminCourtesyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Cortesia Master" — exclusivo dos donos da plataforma.
 * Emite cortesias 'admin' (fantasma) para QUALQUER evento. A autorização é verificada no servidor
 * (RPC issue_admin_courtesy); esta tela só é renderizada para os donos (ver CourtesySection).
 */
export function AdminCourtesyModal({ open, onOpenChange }: AdminCourtesyModalProps) {
  const [events, setEvents] = useState<CourtesyEventOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    supabase.rpc("list_admin_courtesy_events").then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) {
        toast({ title: "Não foi possível carregar os eventos", variant: "destructive" });
        return;
      }
      setEvents((data ?? []).map((event) => ({ id: event.id, title: event.title, event_date: event.event_date })));
    });
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <CourtesyFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cortesia Master"
      description="Emita ingressos de cortesia para qualquer evento da plataforma. Eles não aparecem para o produtor e não entram em vendas ou receita."
      events={events}
      eventsLoading={loading}
      rpc="issue_admin_courtesy"
    />
  );
}
