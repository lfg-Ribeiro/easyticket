import { useEffect, useRef, useState } from "react";
import { Check, Copy, Gift, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { describeCourtesyError } from "@/lib/courtesy";
import { formatEventDate } from "@/lib/utils";
import {
  COURTESY_MAX_QUANTITY,
  ERROR_SELECT_CLASS,
  courtesyValidators,
  describedBy,
  errorClass,
  focusFirstInvalid,
  formatCpf,
  onlyDigits,
  validateCourtesy,
  type CourtesyField,
  type CourtesyValues,
} from "@/lib/validation";

export interface CourtesyEventOption {
  id: string;
  title: string;
  event_date?: string | null;
}

interface IssueResult {
  issued: number;
  user_linked: boolean;
  qr_codes: string[];
}

export interface CourtesyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  events: CourtesyEventOption[];
  eventsLoading?: boolean;
  /** RPC executada no servidor (a autorização real é feita lá). */
  rpc: "issue_admin_courtesy" | "issue_organizer_courtesy";
  onIssued?: () => void;
}

const EMPTY: CourtesyValues = { eventId: "", name: "", email: "", cpf: "", quantity: "1" };

/** Formulário compartilhado pelos modais "Emitir Cortesia" (produtor) e "Cortesia Master" (donos). */
export function CourtesyFormDialog({
  open,
  onOpenChange,
  title,
  description,
  events,
  eventsLoading = false,
  rpc,
  onIssued,
}: CourtesyFormDialogProps) {
  const [values, setValues] = useState<CourtesyValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { errors, setErrors, revalidate, clearErrors } = useFieldErrors<CourtesyField>();
  const contentRef = useRef<HTMLDivElement>(null);

  // Ao abrir: formulário limpo; com um único evento disponível, já vem selecionado
  useEffect(() => {
    if (!open) return;
    setValues({ ...EMPTY, eventId: events.length === 1 ? events[0].id : "" });
    setResult(null);
    setCopied(null);
    clearErrors();
  }, [open, events, clearErrors]);

  const update = (field: keyof CourtesyValues, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    const errorField: CourtesyField = field === "eventId" ? "event" : (field as CourtesyField);
    revalidate(errorField, courtesyValidators[errorField](next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateCourtesy(values);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(contentRef.current);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc(rpc as "issue_admin_courtesy", {
      p_event_id: values.eventId,
      p_guest_name: values.name.trim(),
      p_guest_email: values.email.trim().toLowerCase(),
      p_guest_cpf: onlyDigits(values.cpf),
      p_quantity: Number(values.quantity),
    });
    setSubmitting(false);

    if (error) {
      const info = describeCourtesyError(error);
      if (info.field) {
        setErrors({ [info.field]: info.message });
        focusFirstInvalid(contentRef.current);
      } else {
        toast({ title: "Erro ao emitir cortesia", description: info.message, variant: "destructive" });
      }
      return;
    }

    setResult(data as unknown as IssueResult);
    toast({ title: "Cortesia emitida!" });
    onIssued?.();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast({ title: "Código copiado!" });
    } catch {
      toast({ title: "Não foi possível copiar o código", description: code, variant: "destructive" });
    }
  };

  const issueAnother = () => {
    setResult(null);
    setValues((prev) => ({ ...EMPTY, eventId: prev.eventId }));
    clearErrors();
  };

  const eventError = errors.event;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4" role="status">
            <div className="rounded-xl bg-success/10 p-4 text-sm">
              <p className="font-semibold text-foreground">
                {result.issued === 1 ? "1 cortesia emitida" : `${result.issued} cortesias emitidas`} para{" "}
                {values.name.trim()}.
              </p>
              <p className="mt-1 text-muted-foreground">
                {result.user_linked
                  ? "O ingresso já aparece em Meus Ingressos do convidado."
                  : "O ingresso aparecerá em Meus Ingressos assim que o convidado criar a conta com este e-mail."}
              </p>
            </div>
            <ul className="space-y-2">
              {result.qr_codes.map((code) => (
                <li key={code} className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2">
                  <code className="truncate font-mono text-xs">{code}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Copiar código ${code}`}
                    onClick={() => copyCode(code)}
                  >
                    {copied === code ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={issueAnother}>
                Emitir outra
              </Button>
              <Button type="button" variant="gradient" onClick={() => onOpenChange(false)}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <Label htmlFor="courtesy-event" className="text-sm font-semibold">
                Evento
              </Label>
              <Select value={values.eventId} onValueChange={(value) => update("eventId", value)}>
                <SelectTrigger
                  id="courtesy-event"
                  className={errorClass(eventError, ERROR_SELECT_CLASS)}
                  aria-invalid={eventError ? true : undefined}
                  aria-describedby={describedBy("courtesy-event", eventError)}
                >
                  <SelectValue placeholder={eventsLoading ? "Carregando eventos…" : "Selecione o evento"} />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                      {event.event_date ? ` • ${formatEventDate(event.event_date)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="courtesy-event" message={eventError} />
            </div>

            <div>
              <Label htmlFor="courtesy-name" className="text-sm font-semibold">
                Nome do convidado
              </Label>
              <Input
                id="courtesy-name"
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Nome e sobrenome"
                autoComplete="off"
                className={errorClass(errors.name)}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describedBy("courtesy-name", errors.name)}
              />
              <FieldError id="courtesy-name" message={errors.name} />
            </div>

            <div>
              <Label htmlFor="courtesy-email" className="text-sm font-semibold">
                E-mail
              </Label>
              <Input
                id="courtesy-email"
                type="email"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="convidado@email.com"
                autoComplete="off"
                className={errorClass(errors.email)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy("courtesy-email", errors.email)}
              />
              <FieldError id="courtesy-email" message={errors.email} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="courtesy-cpf" className="text-sm font-semibold">
                  CPF
                </Label>
                <Input
                  id="courtesy-cpf"
                  value={values.cpf}
                  onChange={(e) => update("cpf", formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  className={errorClass(errors.cpf)}
                  aria-invalid={errors.cpf ? true : undefined}
                  aria-describedby={describedBy("courtesy-cpf", errors.cpf)}
                />
                <FieldError id="courtesy-cpf" message={errors.cpf} />
              </div>
              <div>
                <Label htmlFor="courtesy-quantity" className="text-sm font-semibold">
                  Qtd.
                </Label>
                <Input
                  id="courtesy-quantity"
                  type="number"
                  min={1}
                  max={COURTESY_MAX_QUANTITY}
                  step={1}
                  value={values.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  className={errorClass(errors.quantity)}
                  aria-invalid={errors.quantity ? true : undefined}
                  aria-describedby={describedBy("courtesy-quantity", errors.quantity)}
                />
                <FieldError id="courtesy-quantity" message={errors.quantity} />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gradient" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Emitindo…
                  </>
                ) : (
                  "Emitir cortesia"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
