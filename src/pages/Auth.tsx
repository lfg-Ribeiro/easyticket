import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket, Mail, Lock, User, ArrowRight, Phone, CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { cn } from "@/lib/utils";
import {
  compact,
  describedBy,
  errorClass,
  focusFirstInvalid,
  validateCpf,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
} from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { pageTitle } from "@/lib/seo";

type AuthField = "fullName" | "cpf" | "phone" | "email" | "password";

export default function Auth() {
  usePageMeta({
    title: pageTitle("Entrar ou Criar Conta"),
    description: "Entre ou crie sua conta no EasyTicket para comprar ingressos, acessar seus QR Codes e acompanhar seus eventos.",
  });

  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { errors, setErrors, revalidate, clearErrors } = useFieldErrors<AuthField>();
  const formRef = useRef<HTMLFormElement>(null);
  const forgotFormRef = useRef<HTMLFormElement>(null);

  const switchMode = (next: "login" | "signup" | "forgot") => {
    clearErrors();
    setMode(next);
  };

  // Na criação de conta a senha precisa ter 6+ caracteres; no login só exigimos que seja informada
  // (contas antigas não devem ser bloqueadas por regra de tamanho).
  const fieldValidators: Record<AuthField, (value: string) => string | undefined> = {
    fullName: validateFullName,
    cpf: (value) => validateCpf(value),
    phone: (value) => validatePhone(value),
    email: validateEmail,
    password: (value) => validatePassword(value, { checkLength: mode === "signup" }),
  };

  /** Atualiza o valor e, se o campo estava com erro, remove-o assim que a correção for válida. */
  const handleFieldChange = (field: AuthField, value: string, setter: (v: string) => void) => {
    setter(value);
    revalidate(field, fieldValidators[field](value));
  };

  const validateForm = () => {
    const next = compact<AuthField>({
      fullName: mode === "signup" ? fieldValidators.fullName(fullName) : undefined,
      cpf: mode === "signup" ? fieldValidators.cpf(cpf) : undefined,
      phone: mode === "signup" ? fieldValidators.phone(phone) : undefined,
      email: fieldValidators.email(email),
      password: fieldValidators.password(password),
    });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current);
      return false;
    }
    return true;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const { signIn, signUp } = useAuth();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      focusFirstInvalid(forgotFormRef.current);
      return;
    }

    setSubmitting(true);
    try {
      await supabase.functions.invoke("send-password-reset", {
        body: { email: email.trim() },
      });
      toast({
        title: "E-mail enviado!",
        description: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
      });
      setMode("login");
    } catch {
      toast({
        title: "E-mail enviado!",
        description: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          if (error.message.includes("Invalid login")) {
            toast({ title: "E-mail ou senha incorretos", variant: "destructive" });
          } else {
            toast({ title: error.message, variant: "destructive" });
          }
          return;
        }
        toast({ title: "Login realizado com sucesso!" });
      } else {
        const cpfDigits = cpf.replace(/\D/g, "");
        const phoneDigits = phone.replace(/\D/g, "");
        const { error } = await signUp(email.trim(), password, fullName.trim(), cpfDigits, phoneDigits);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({ title: "Este e-mail já está cadastrado", variant: "destructive" });
          } else {
            toast({ title: error.message, variant: "destructive" });
          }
          return;
        }
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu e-mail para confirmar a conta.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Forgot password view
  if (mode === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl gradient-primary flex items-center justify-center">
              <Ticket className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Recuperar Senha</h1>
            <p className="text-muted-foreground text-sm">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          <form ref={forgotFormRef} onSubmit={handleForgotPassword} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-sm font-medium">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="resetEmail"
                  type="email"
                  value={email}
                  onChange={(e) => handleFieldChange("email", e.target.value, setEmail)}
                  placeholder="seu@email.com"
                  className={cn("pl-10", errorClass(errors.email))}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describedBy("resetEmail", errors.email)}
                  autoFocus
                />
              </div>
              <FieldError id="resetEmail" message={errors.email} />
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Enviar link de recuperação
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => switchMode("login")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl gradient-primary flex items-center justify-center">
            <Ticket className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">EasyTicket</h1>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => handleFieldChange("fullName", e.target.value, setFullName)}
                  placeholder="Nome e sobrenome"
                  autoComplete="name"
                  className={cn("pl-10", errorClass(errors.fullName))}
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={describedBy("fullName", errors.fullName)}
                />
              </div>
              <FieldError id="fullName" message={errors.fullName} />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => handleFieldChange("cpf", formatCpf(e.target.value), setCpf)}
                  placeholder="000.000.000-00"
                  className={cn("pl-10", errorClass(errors.cpf))}
                  inputMode="numeric"
                  aria-invalid={errors.cpf ? true : undefined}
                  aria-describedby={describedBy("cpf", errors.cpf)}
                />
              </div>
              <FieldError id="cpf" message={errors.cpf} />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => handleFieldChange("phone", formatPhone(e.target.value), setPhone)}
                  placeholder="(11) 99999-9999"
                  className={cn("pl-10", errorClass(errors.phone))}
                  inputMode="numeric"
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={describedBy("phone", errors.phone)}
                />
              </div>
              <FieldError id="phone" message={errors.phone} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => handleFieldChange("email", e.target.value, setEmail)}
                placeholder="seu@email.com"
                autoComplete="email"
                className={cn("pl-10", errorClass(errors.email))}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy("email", errors.email)}
              />
            </div>
            <FieldError id="email" message={errors.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => handleFieldChange("password", e.target.value, setPassword)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={cn("pl-10", errorClass(errors.password))}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={describedBy("password", errors.password)}
              />
            </div>
            <FieldError id="password" message={errors.password} />
            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="rounded-sm text-xs text-primary hover:text-primary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (
              <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Entrar" : "Criar Conta"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="text-center">
          <button
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
          </button>
        </div>

        {/* Back to events */}
        <div className="text-center">
          <button
            onClick={() => navigate("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar para eventos
          </button>
        </div>
      </div>
    </div>
  );
}