import { Users } from "lucide-react";
import { useReferral } from "@/hooks/useReferral";

/** Selo discreto "Indicação: <atlética>" no resumo do checkout (só aparece quando há indicação ativa). */
export function ReferralBadge({ eventId }: { eventId: string }) {
  const { code, name } = useReferral(eventId);
  if (!code) return null;

  return (
    <div
      data-testid="referral-badge"
      title={name ? `Código: ${code}` : undefined}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"
    >
      <Users className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">Indicação: {name ?? code}</span>
    </div>
  );
}
