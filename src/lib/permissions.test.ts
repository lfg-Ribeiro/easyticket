import { describe, it, expect } from "vitest";
import { getOrganizerPermissions, MASTER_ADMIN_EMAIL } from "./permissions";

describe("getOrganizerPermissions", () => {
  it("producer (organizer only) can view the panel but not manage", () => {
    const p = getOrganizerPermissions({ isOrganizer: true, isAdmin: false, email: "produtor@x.com" });
    expect(p.canAccessOrganizer).toBe(true);
    expect(p.canManageEvents).toBe(false);
  });

  it("admin keeps full control", () => {
    const p = getOrganizerPermissions({ isOrganizer: false, isAdmin: true, email: "a@x.com" });
    expect(p.canAccessOrganizer).toBe(true);
    expect(p.canManageEvents).toBe(true);
  });

  it("master account keeps full control without roles", () => {
    const p = getOrganizerPermissions({ isOrganizer: false, isAdmin: false, email: MASTER_ADMIN_EMAIL });
    expect(p.canManageEvents).toBe(true);
  });

  it("regular user has no organizer access", () => {
    const p = getOrganizerPermissions({ isOrganizer: false, isAdmin: false, email: "c@x.com" });
    expect(p.canAccessOrganizer).toBe(false);
    expect(p.canManageEvents).toBe(false);
  });
});
