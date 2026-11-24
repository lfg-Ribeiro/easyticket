import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TITLE, meta, metaContent, resetHead } from "@/test/seoHead";
import { createMockState } from "@/test/supabaseMock";
import Auth from "./Auth";
import Index from "./Index";
import MyTickets from "./MyTickets";
import NotFound from "./NotFound";
import OrganizerDashboard from "./OrganizerDashboard";
import Profile from "./Profile";
import PurchaseSuccess from "./PurchaseSuccess";
import SaibaMais from "./SaibaMais";

const mock = vi.hoisted(() => ({ state: null as unknown as ReturnType<typeof createMockState> }));
vi.mock("@/integrations/supabase/client", async () => {
  const helpers = await import("@/test/supabaseMock");
  mock.state = helpers.createMockState();
  return { supabase: helpers.createSupabaseMock(mock.state) };
});
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// referência estável: várias páginas refazem a busca quando o objeto `user` muda
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "ana@email.com", user_metadata: { full_name: "Ana Souza" } },
  session: { access_token: "token" },
  loading: false,
  isOrganizer: true,
  isAdmin: false,
  canManageEvents: true,
  canAccessOrganizer: true,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

beforeEach(() => {
  resetHead();
  mock.state.db = {};
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const robots = () => metaContent('meta[name="robots"]');

const cases: { name: string; element: React.ReactElement; title: string; noindex: boolean; wait?: RegExp }[] = [
  { name: "Home", element: <Index />, title: "EasyTicket — Ingressos digitais para festas, shows e eventos", noindex: false },
  { name: "Auth", element: <Auth />, title: "Entrar ou Criar Conta | EasyTicket", noindex: false },
  { name: "Meus Ingressos", element: <MyTickets />, title: "Meus Ingressos | EasyTicket", noindex: true },
  { name: "Perfil", element: <Profile />, title: "Meu Perfil | EasyTicket", noindex: true },
  { name: "Organizador", element: <OrganizerDashboard />, title: "Painel do Organizador | EasyTicket", noindex: true },
  { name: "Compra confirmada", element: <PurchaseSuccess />, title: "Compra Confirmada | EasyTicket", noindex: true },
  { name: "404", element: <NotFound />, title: "Página não encontrada | EasyTicket", noindex: true },
  { name: "Saiba mais", element: <SaibaMais />, title: "Venda Ingressos Online | EasyTicket", noindex: false },
];

describe("título, descrição e robots por página", () => {
  it.each(cases)("$name", async ({ element, title, noindex }) => {
    const { unmount } = render(<MemoryRouter>{element}</MemoryRouter>);

    await waitFor(() => expect(document.title).toBe(title));
    expect(metaContent('meta[name="description"]')!.length).toBeGreaterThan(40);
    expect(metaContent('meta[property="og:title"]')).toBe(title);
    expect(metaContent('meta[name="twitter:title"]')).toBe(title);
    if (noindex) expect(robots()).toBe("noindex, nofollow");
    else expect(meta('meta[name="robots"]')).toBeNull();

    unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(meta('meta[name="robots"]')).toBeNull();
  });

  it("descrição da Home destaca PIX/cartão e QR Code", async () => {
    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(document.title).toBe(cases[0].title));
    const description = metaContent('meta[name="description"]')!;
    expect(description).toMatch(/PIX/);
    expect(description).toMatch(/cartão/);
    expect(description).toMatch(/QR Code/);
  });
});

describe("cobertura: toda página tem meta, e as privadas são noindex", () => {
  const pagesDir = path.resolve(process.cwd(), "src/pages");
  const files = fs.readdirSync(pagesDir).filter((f) => /^[A-Z].*\.tsx$/.test(f) && !f.includes(".test."));
  const PRIVATE = ["MyTickets", "Profile", "OrganizerDashboard", "OrganizerScan", "AdminUsers", "Validator", "UpdatePassword", "PurchaseSuccess", "NotFound"];

  it("encontra as páginas esperadas", () => {
    expect(files.length).toBeGreaterThanOrEqual(13);
  });

  it.each(files)("%s usa usePageMeta", (file) => {
    const source = fs.readFileSync(path.join(pagesDir, file), "utf8");
    expect(source).toContain("usePageMeta(");
    const name = file.replace(".tsx", "");
    if (PRIVATE.includes(name)) expect(source).toMatch(/noindex:\s*true/);
  });
});
