import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EditProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authId: string;
  currentName: string | null;
  currentPhone: string | null;
  currentCpf: string | null;
  onSaved: () => void;
}

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

export function EditProfileDrawer({
  open,
  onOpenChange,
  authId,
  currentName,
  currentPhone,
  currentCpf,
  onSaved,
}: EditProfileDrawerProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName || "");
      setPhone(currentPhone ? formatPhone(currentPhone) : "");
      setCpf(currentCpf ? formatCpf(currentCpf) : "");
    }
  }, [open, currentName, currentPhone, currentCpf]);

  const handleSave = async () => {
    const phoneDigits = phone.replace(/\D/g, "");
    const cpfDigits = cpf.replace(/\D/g, "");

    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      toast({ title: "Informe um telefone válido", variant: "destructive" });
      return;
    }
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      toast({ title: "Informe um CPF válido", variant: "destructive" });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      toast({ title: "Informe seu nome", variant: "destructive" });
      return;
    }
    if (trimmedName.length > 100) {
      toast({ title: "Nome muito longo (máx. 100 caracteres)", variant: "destructive" });
      return;
    }

    setSaving(true);

    const updateData: Record<string, string | null> = {
      full_name: trimmedName,
      phone: phoneDigits || null,
      cpf: cpfDigits || null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("auth_id", authId);

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar perfil", variant: "destructive" });
      return;
    }

    toast({ title: "Perfil atualizado com sucesso! ✅" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Editar perfil</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Nome completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="pl-10"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone" className="text-sm font-medium">
                Telefone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="pl-10"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* CPF */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-cpf" className="text-sm font-medium">
                CPF
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="pl-10"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <DrawerFooter className="pt-6">
            <Button
              onClick={handleSave}
              variant="gradient"
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                "Salvar alterações"
              )}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                Cancelar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
