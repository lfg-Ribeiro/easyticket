import { useState } from "react";
import { Crown, Gift } from "lucide-react";
import { AdminCourtesyModal } from "@/components/organizer/AdminCourtesyModal";
import { CourtesyList } from "@/components/organizer/CourtesyList";
import { IssueCourtesyModal } from "@/components/organizer/IssueCourtesyModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformOwner } from "@/lib/permissions";

interface CourtesySectionProps {
  /** Eventos visíveis para quem está logado (os do produtor, ou todos para admin/master). */
  events: { id: string; title: string; event_date?: string | null }[];
}

/**
 * Seção "Cortesias" do painel do organizador:
 *  - "Emitir Cortesia" (3.2): produtores/admins, para os eventos que enxergam;
 *  - "Cortesia Master" (3.1): SOMENTE donos da plataforma (permissions.ts); a RPC valida de novo no servidor.
 */
export function CourtesySection({ events }: CourtesySectionProps) {
  const { user, canAccessOrganizer } = useAuth();
  const [issueOpen, setIssueOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const owner = isPlatformOwner(user?.email);
  if (!canAccessOrganizer && !owner) return null;

  return (
    <section aria-labelledby="courtesies-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="courtesies-title" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
          Cortesias
        </h2>
        <div className="flex flex-wrap gap-2">
          {owner && (
            <Button variant="outline" onClick={() => setMasterOpen(true)}>
              <Crown className="mr-2 h-4 w-4" aria-hidden="true" />
              Cortesia Master
            </Button>
          )}
          <Button variant="gradient" disabled={events.length === 0} onClick={() => setIssueOpen(true)}>
            <Gift className="mr-2 h-4 w-4" aria-hidden="true" />
            Emitir Cortesia
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <CourtesyList events={events} refreshKey={refreshKey} />
      </div>

      <IssueCourtesyModal
        open={issueOpen}
        onOpenChange={setIssueOpen}
        events={events}
        onIssued={() => setRefreshKey((key) => key + 1)}
      />
      {owner && <AdminCourtesyModal open={masterOpen} onOpenChange={setMasterOpen} />}
    </section>
  );
}
