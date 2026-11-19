export const MASTER_ADMIN_EMAIL = "lribeiro@easyticket.com";

/**
 * Donos da plataforma. Espelha public.platform_owner_emails() no banco
 * (a autorização real é feita no servidor pelas RPCs issue_admin_courtesy /
 * list_admin_courtesy_events — aqui só decidimos o que mostrar na interface).
 */
export const PLATFORM_OWNER_EMAILS = [MASTER_ADMIN_EMAIL, "zluan720@gmail.com"] as const;

export function isPlatformOwner(email?: string | null): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  return !!normalized && (PLATFORM_OWNER_EMAILS as readonly string[]).includes(normalized);
}

export interface RoleInput {
  isOrganizer: boolean;
  isAdmin: boolean;
  email?: string | null;
}

/**
 * Organizer-area permissions.
 * - canAccessOrganizer: can open /organizer (read-only analytics).
 * - canManageEvents: can create/edit/delete events, switch lots and use the scanner.
 *   Producers (organizer role) are read-only; only admins and the master account manage.
 * - isPlatformOwner: dono da plataforma (acesso à "Cortesia Master"). Pode abrir /organizer,
 *   mas isso NÃO concede gestão de eventos.
 * - canIssueCourtesy: pode emitir cortesia de produtor ("Emitir Cortesia") nos eventos
 *   que enxerga — produtores, admins, master e donos.
 */
export function getOrganizerPermissions({ isOrganizer, isAdmin, email }: RoleInput) {
  const isMasterAdmin = email === MASTER_ADMIN_EMAIL;
  const owner = isPlatformOwner(email);
  const canManageEvents = isAdmin || isMasterAdmin;
  const canAccessOrganizer = isOrganizer || canManageEvents || owner;
  return {
    isMasterAdmin,
    isPlatformOwner: owner,
    canAccessOrganizer,
    canManageEvents,
    canIssueCourtesy: canAccessOrganizer,
  };
}
