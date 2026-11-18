import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditProfileDrawer } from "./EditProfileDrawer";
import { ProfileCompletionCard } from "./ProfileCompletionCard";
import Profile from "@/pages/Profile";

const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
const updateUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (...args: unknown[]) => (update as (...a: unknown[]) => unknown)(...args),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { full_name: "Ana Souza", phone: "11999998888", cpf: "52998224725" },
          }),
        }),
      }),
    }),
    auth: { updateUser: (...args: unknown[]) => updateUser(...args) },
  },
}));
const toastFn = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastFn(...args),
  useToast: () => ({ toast: toastFn }),
}));
// referências estáveis: Profile busca o perfil em um useEffect que depende de `user`
const authValue = {
  user: { id: "u1", email: "ana@email.com", user_metadata: { full_name: "Ana Souza" } },
  loading: false,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authValue }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("EditProfileDrawer – validação inline", () => {
  beforeEach(() => {
    update.mockClear();
    updateEq.mockReset().mockResolvedValue({ error: null });
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  const renderDrawer = (props: Partial<React.ComponentProps<typeof EditProfileDrawer>> = {}) =>
    render(
      <EditProfileDrawer
        open
        onOpenChange={() => {}}
        authId="u1"
        currentName="Ana"
        currentPhone="11999998888"
        currentCpf="52998224725"
        onSaved={() => {}}
        {...props}
      />,
    );

  it("não salva nome sem sobrenome, telefone incompleto ou CPF inválido", async () => {
    renderDrawer({ currentPhone: null, currentCpf: null });
    type("Telefone", "1199");
    type("CPF", "11111111111");
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(screen.getByText("Informe nome e sobrenome")).toBeInTheDocument();
    expect(screen.getByText("Informe o telefone com DDD (10 ou 11 dígitos)")).toBeInTheDocument();
    expect(screen.getByText("CPF inválido. Confira os números digitados")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nome completo")));
  });

  it("corrigir um campo remove só o erro dele", () => {
    renderDrawer({ currentPhone: null, currentCpf: null });
    type("Telefone", "1199");
    type("CPF", "11111111111");
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    type("CPF", "52998224725");
    expect(screen.queryByText(/CPF inválido/)).not.toBeInTheDocument();
    expect(screen.getByText("Informe o telefone com DDD (10 ou 11 dígitos)")).toBeInTheDocument();
    expect(screen.getByText("Informe nome e sobrenome")).toBeInTheDocument();
  });

  it("telefone e CPF continuam opcionais; dados válidos salvam sem alterar o formato enviado", async () => {
    renderDrawer({ currentName: "Ana Souza", currentPhone: null, currentCpf: null });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({ full_name: "Ana Souza", phone: null, cpf: null });
  });
});

describe("ProfileCompletionCard – validação inline", () => {
  beforeEach(() => update.mockClear());

  it("valida apenas os campos exibidos", () => {
    render(<ProfileCompletionCard authId="u1" currentPhone="11999998888" currentCpf={null} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Informe seu CPF")).toBeInTheDocument();
    expect(screen.queryByLabelText("Telefone")).not.toBeInTheDocument();
    expect(screen.queryByText(/telefone/i)).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("Profile – troca de senha com validação inline", () => {
  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue({ error: null });
  });

  it("mostra erros de senha curta e de confirmação divergente, e só envia quando válido", async () => {
    render(<Profile />);
    const save = await screen.findByRole("button", { name: "Salvar nova senha" });
    expect(save).toBeEnabled();

    fireEvent.click(save);
    expect(screen.getByText("Informe a nova senha")).toBeInTheDocument();
    expect(screen.getByText("Confirme a nova senha")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nova senha")));

    type("Nova senha", "123");
    expect(screen.getByText("A senha deve ter pelo menos 6 caracteres")).toBeInTheDocument();
    type("Nova senha", "123456");
    expect(screen.queryByText(/pelo menos 6/)).not.toBeInTheDocument();

    type("Confirmar senha", "1234567");
    expect(screen.getByText("As senhas não conferem")).toBeInTheDocument();
    type("Confirmar senha", "123456");
    expect(screen.queryByText("As senhas não conferem")).not.toBeInTheDocument();

    fireEvent.click(save);
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "123456" }));
  });
});
