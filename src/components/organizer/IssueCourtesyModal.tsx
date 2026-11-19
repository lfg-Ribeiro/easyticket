import { CourtesyFormDialog, type CourtesyEventOption } from "@/components/organizer/CourtesyFormDialog";

interface IssueCourtesyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Eventos que o produtor enxerga (os seus). */
  events: CourtesyEventOption[];
  onIssued?: () => void;
}

/** "Emitir Cortesia" (Roadmap 3.2) — cortesia de produtor ('organizer') para os próprios eventos. */
export function IssueCourtesyModal({ open, onOpenChange, events, onIssued }: IssueCourtesyModalProps) {
  return (
    <CourtesyFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Emitir Cortesia"
      description="O convidado recebe o ingresso em Meus Ingressos. Cortesias não contam como vendas e não consomem o estoque dos lotes."
      events={events}
      rpc="issue_organizer_courtesy"
      onIssued={onIssued}
    />
  );
}
