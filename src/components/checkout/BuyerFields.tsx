import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import {
  describedBy,
  errorClass,
  type BuyerField,
  type BuyerValues,
  type FieldErrors,
} from "@/lib/validation";

interface BuyerFieldsProps {
  /** Prefixo dos ids, para não duplicar ids quando painel e drawer coexistem no DOM. */
  idPrefix: string;
  values: BuyerValues;
  errors: FieldErrors<BuyerField>;
  /** Recebe o valor cru; quem usa aplica a máscara (CPF/telefone) e revalida. */
  onChange: (field: BuyerField, rawValue: string) => void;
}

/** "Seus dados" do checkout — compartilhado entre CheckoutPanel (desktop) e CheckoutDrawer (mobile). */
export function BuyerFields({ idPrefix, values, errors, onChange }: BuyerFieldsProps) {
  const field = (name: BuyerField) => {
    const id = `${idPrefix}-${name}`;
    return {
      id,
      name,
      value: values[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(name, e.target.value),
      className: cn("mt-1", errorClass(errors[name])),
      "aria-invalid": errors[name] ? (true as const) : undefined,
      "aria-describedby": describedBy(id, errors[name]),
    };
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Seus dados</h3>
      <div>
        <Label htmlFor={`${idPrefix}-name`} className="text-sm">Nome completo</Label>
        <Input {...field("name")} autoComplete="name" placeholder="Nome e sobrenome" />
        <FieldError id={`${idPrefix}-name`} message={errors.name} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-email`} className="text-sm">E-mail</Label>
        <Input {...field("email")} type="email" autoComplete="email" placeholder="seu@email.com" />
        <FieldError id={`${idPrefix}-email`} message={errors.email} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-cpf`} className="text-sm">CPF</Label>
        <Input {...field("cpf")} inputMode="numeric" placeholder="000.000.000-00" />
        <FieldError id={`${idPrefix}-cpf`} message={errors.cpf} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-phone`} className="text-sm">Telefone</Label>
        <Input {...field("phone")} type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="(11) 99999-9999" />
        <FieldError id={`${idPrefix}-phone`} message={errors.phone} />
      </div>
    </div>
  );
}
