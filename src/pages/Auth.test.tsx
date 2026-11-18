import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./Auth";

const signIn = vi.fn();
const signUp = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, signIn, signUp }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const renderAuth = () =>
  render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>,
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const openSignup = () => fireEvent.click(screen.getByText("Não tem conta? Cadastre-se"));
const submit = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("Auth – validação inline", () => {
  beforeEach(() => {
    signIn.mockReset().mockResolvedValue({ error: null });
    signUp.mockReset().mockResolvedValue({ error: null });
  });

  it("cadastro vazio: mostra erro em cada campo, marca aria-invalid e foca o primeiro", async () => {
    renderAuth();
    openSignup();
    submit(/criar conta/i);

    expect(screen.getByText("Informe seu nome completo")).toBeInTheDocument();
    expect(screen.getByText("Informe seu CPF")).toBeInTheDocument();
    expect(screen.getByText("Informe seu telefone")).toBeInTheDocument();
    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha")).toBeInTheDocument();

    const name = screen.getByLabelText("Nome completo");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveClass("border-destructive");
    expect(name).toHaveAttribute("aria-describedby", "fullName-error");
    expect(signUp).not.toHaveBeenCalled();

    await waitFor(() => expect(document.activeElement).toBe(name));
  });

  it("limpa o erro de um campo só quando o valor digitado passa a ser válido", () => {
    renderAuth();
    openSignup();
    submit(/criar conta/i);

    // nome: ainda inválido -> mensagem atualizada; depois válido -> some
    type("Nome completo", "Ana");
    expect(screen.getByText("Informe nome e sobrenome")).toBeInTheDocument();
    type("Nome completo", "Ana Souza");
    expect(screen.queryByText("Informe nome e sobrenome")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).not.toHaveAttribute("aria-invalid");

    // CPF com 11 dígitos mas dígito verificador errado continua em erro
    type("CPF", "11111111111");
    expect(screen.getByText("CPF inválido. Confira os números digitados")).toBeInTheDocument();
    type("CPF", "52998224725");
    expect(screen.queryByText(/CPF inválido/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");

    // os demais campos continuam com erro
    expect(screen.getByText("Informe seu telefone")).toBeInTheDocument();
    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha")).toBeInTheDocument();
  });

  it("valida e-mail, telefone e tamanho da senha", () => {
    renderAuth();
    openSignup();
    type("Nome completo", "Ana Souza");
    type("CPF", "52998224725");
    type("Telefone", "1199");
    type("E-mail", "ana@email");
    type("Senha", "12345");
    submit(/criar conta/i);

    expect(screen.getByText("Informe o telefone com DDD (10 ou 11 dígitos)")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido, como nome@email.com")).toBeInTheDocument();
    expect(screen.getByText("A senha deve ter pelo menos 6 caracteres")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("cadastro válido chama signUp com os mesmos argumentos de antes (CPF/telefone só dígitos)", async () => {
    renderAuth();
    openSignup();
    type("Nome completo", "Ana Souza");
    type("CPF", "52998224725");
    type("Telefone", "11999998888");
    type("E-mail", " ana@email.com ");
    type("Senha", "123456");
    submit(/criar conta/i);

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("ana@email.com", "123456", "Ana Souza", "52998224725", "11999998888"),
    );
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it("login: exige e-mail válido e senha, mas não aplica o mínimo de 6 a senhas antigas", async () => {
    renderAuth();
    submit(/entrar/i);
    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();

    type("E-mail", "ana@email.com");
    type("Senha", "123");
    expect(screen.queryByText(/Informe seu e-mail|Informe sua senha/)).not.toBeInTheDocument();
    submit(/entrar/i);
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("ana@email.com", "123"));
  });

  it("trocar de modo descarta os erros anteriores", () => {
    renderAuth();
    submit(/entrar/i);
    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
    openSignup();
    expect(screen.queryByText("Informe seu e-mail")).not.toBeInTheDocument();
  });

  it("recuperar senha: valida o e-mail inline", () => {
    renderAuth();
    fireEvent.click(screen.getByText("Esqueci minha senha"));
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));
    expect(screen.getByText("Informe seu e-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
  });
});
