import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/FloatingWhatsApp", () => ({ FloatingWhatsApp: () => null }));
vi.mock("./pages/PurchaseSuccess", () => ({ default: () => <div>pagina-de-sucesso</div> }));

describe("rotas do App", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const visit = (path: string) => {
    window.history.pushState({}, "", path);
    render(<App />);
  };

  it("qualquer rota desconhecida cai na página 404 de marca", () => {
    visit("/rota-que-nao-existe/de-verdade");
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explorar eventos/i })).toHaveAttribute("href", "/");
  });

  it.each(["/purchase-success?eventId=e1", "/obrigado?eventId=e1"])("%s abre a página de compra concluída", (path) => {
    visit(path);
    expect(screen.getByText("pagina-de-sucesso")).toBeInTheDocument();
  });
});
