import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, CreditCard, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProfileCompletionCardProps {
  authId: string;
  currentPhone?: string | null;
  currentCpf?: string | null;
  onComplete: () => void;
}

export function ProfileCompletionCard({
  authId,
  currentPhone,
  currentCpf,
  onComplete,
}: ProfileCompletionCardProps) {
  const [phone, setPhone] = useState(currentPhone || "");
  const [cpf, setCpf] = useState(currentCpf || "");
  const [saving, setSaving] = useState(false);

  const isComplete = !!currentPhone && !!currentCpf;

  if (isComplete) return null;

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

  const handleSave = async () => {
    const phoneDigits = phone.replace(/\D/g, "");
    const cpfDigits = cpf.replace(/\D/g, "");

    if (phoneDigits.length < 10) {
      toast({ title: "Informe um telefone válido", variant: "destructive" });
      return;
    }
    if (cpfDigits.length !== 11) {
      toast({ title: "Informe um CPF válido", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: phoneDigits, cpf: cpfDigits })
      .eq("auth_id", authId);

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar perfil", variant: "destructive" });
      return;
    }

    toast({ title: "Perfil atualizado com sucesso! ✅" });
    onComplete();
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm">Complete seu perfil</h3>
          <p className="text-xs text-muted-foreground">
            Facilite suas próximas compras preenchendo os dados abaixo
          </p>
        </div>
      </div>

      {!currentPhone && (
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium">
            Telefone
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="pl-10"
            />
          </div>
        </div>
      )}

      {!currentCpf && (
        <div className="space-y-1.5">
          <Label htmlFor="cpf" className="text-sm font-medium">
            CPF
          </Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="pl-10"
            />
          </div>
        </div>
      )}

      <Button
        onClick={handleSave}
        variant="gradient"
        size="sm"
        className="w-full"
        disabled={saving}
      >
        {saving ? (
          <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          "Salvar"
        )}
      </Button>
    </div>
  );
}
