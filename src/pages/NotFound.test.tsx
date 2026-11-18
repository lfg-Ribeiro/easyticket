import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotFound from "./NotFound";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

describe("NotFound", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <NotFound />
      </MemoryRouter>,
    );

  it("mostra a mensagem em pt-BR dentro do layout do app (cabeçalho/navegação)", () => {
    renderAt("/evento-que-nao-existe");
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Página não encontrada" })).toBeInTheDocument();
    expect(screen.getByText(/pode ter expirado ou o evento não está mais disponível/i)).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("exibe discretamente o endereço acessado", () => {
    renderAt("/evento-que-nao-existe");
    expect(screen.getByText("/evento-que-nao-existe")).toBeInTheDocument();
  });

  it("abrevia caminhos muito longos", () => {
    renderAt(`/${"a".repeat(200)}`);
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });

  it("oferece links para explorar eventos (/) e para Meus ingressos (/tickets)", () => {
    renderAt("/qualquer-coisa");
    expect(screen.getByRole("link", { name: /explorar eventos/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /meus ingressos/i })).toHaveAttribute("href", "/tickets");
  });

  it("mantém o log de rota inexistente", () => {
    renderAt("/qualquer-coisa");
    expect(console.error).toHaveBeenCalledWith(
      "404 Error: User attempted to access non-existent route:",
      "/qualquer-coisa",
    );
  });
});
