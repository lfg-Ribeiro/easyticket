import { describe, it, expect } from "vitest";
import { getOrganizerPermissions, isPlatformOwner, MASTER_ADMIN_EMAIL, PLATFORM_OWNER_EMAILS } from "./permissions";

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

describe("platform owners (Cortesia Master)", () => {
  it("reconhece os dois donos, sem diferenciar maiúsculas/minúsculas e espaços", () => {
    expect(PLATFORM_OWNER_EMAILS).toEqual(["lribeiro@easyticket.com", "zluan720@gmail.com"]);
    expect(isPlatformOwner("lribeiro@easyticket.com")).toBe(true);
    expect(isPlatformOwner("ZLuan720@Gmail.com")).toBe(true);
    expect(isPlatformOwner("  zluan720@gmail.com ")).toBe(true);
  });

  it("não reconhece outros e-mails, nem vazio", () => {
    ["admin@easyticket.com", "produtor@x.com", "zluan720@gmail.com.br", "xzluan720@gmail.com", "", null, undefined].forEach(
      (email) => expect(isPlatformOwner(email)).toBe(false),
    );
  });

  it("dono sem papéis abre o painel e emite cortesia, mas NÃO gerencia eventos", () => {
    const p = getOrganizerPermissions({ isOrganizer: false, isAdmin: false, email: "zluan720@gmail.com" });
    expect(p.isPlatformOwner).toBe(true);
    expect(p.canAccessOrganizer).toBe(true);
    expect(p.canIssueCourtesy).toBe(true);
    expect(p.canManageEvents).toBe(false);
  });

  it("produtor emite cortesia, mas não é dono; usuário comum não faz nenhuma das duas", () => {
    const producer = getOrganizerPermissions({ isOrganizer: true, isAdmin: false, email: "produtor@x.com" });
    expect(producer.canIssueCourtesy).toBe(true);
    expect(producer.isPlatformOwner).toBe(false);
    const regular = getOrganizerPermissions({ isOrganizer: false, isAdmin: false, email: "c@x.com" });
    expect(regular.canIssueCourtesy).toBe(false);
    expect(regular.isPlatformOwner).toBe(false);
  });
});
