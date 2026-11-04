export const MASTER_ADMIN_EMAIL = "lribeiro@easyticket.com";

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
 */
export function getOrganizerPermissions({ isOrganizer, isAdmin, email }: RoleInput) {
  const isMasterAdmin = email === MASTER_ADMIN_EMAIL;
  const canManageEvents = isAdmin || isMasterAdmin;
  return {
    isMasterAdmin,
    canAccessOrganizer: isOrganizer || canManageEvents,
    canManageEvents,
  };
}
