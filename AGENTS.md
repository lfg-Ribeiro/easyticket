# Agent Rules

- Organizer-area access (nav links, route guards, panels) must be decided by the shared `canAccessOrganizer` flag exposed by `src/hooks/useAuth.tsx`, never by a per-component check. Why: the same access rule is read by the header, the mobile menu and the route guard, and duplicating it lets a link appear for a role the guard then rejects (or hides for a role that is actually allowed).
- Roles are read only from the `user_roles` table via `useAuth` (`isOrganizer`, `isAdmin`, `isValidator`); the master account in `MASTER_ADMIN_EMAIL` is the single email-based exception. Why: roles never live on the profile/users table and client-side storage is not a source of privilege.
- Keep the frontend flag and the server-side checks (RLS policies, Edge Functions) in agreement when either changes, so a visible link is never a dead end.
