import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Link2, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { downloadTextFile } from "@/lib/download";
import { formatBRL } from "@/lib/purchase";
import { buildReferralLink, normalizeRefCode, suggestRefCode } from "@/lib/referral";
import {
  CONFIRMED_PAYMENT_STATUSES,
  buildReferralReport,
  referralReportToCsv,
  type ReportAffiliate,
  type ReportOrder,
} from "@/lib/referral-report";
import {
  affiliateValidators,
  describedBy,
  errorClass,
  focusFirstInvalid,
  parseCommissionPercent,
  validateAffiliate,
  type AffiliateField,
  type AffiliateValues,
} from "@/lib/validation";

interface AffiliatesSectionProps {
  events: { id: string; title: string }[];
}

const EMPTY: AffiliateValues = { name: "", refCode: "", commission: "" };
const money = (cents: number) => formatBRL(cents / 100);

/**
 * "Atléticas & Comissionados" (Roadmap 3.3): cadastro + gerador de link de indicação e relatório
 * segmentado por ?ref=. O relatório usa SOMENTE pedidos confirmados/pagos (cortesias não têm pedido).
 */
export function AffiliatesSection({ events }: AffiliatesSectionProps) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [affiliates, setAffiliates] = useState<ReportAffiliate[]>([]);
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<AffiliateValues>(EMPTY);
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ReportAffiliate | null>(null);
  const { errors, setErrors, revalidate, clearErrors } = useFieldErrors<AffiliateField>();
  const formRef = useRef<HTMLFormElement>(null);

  // Mantém um evento selecionado quando a lista de eventos muda
  useEffect(() => {
    if (!events.some((event) => event.id === eventId)) setEventId(events[0]?.id ?? "");
  }, [events, eventId]);

  const selectedEvent = events.find((event) => event.id === eventId);

  const load = useCallback(async () => {
    if (!eventId) {
      setAffiliates([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [affiliatesRes, ordersRes] = await Promise.all([
      supabase
        .from("event_affiliates")
        .select("id, event_id, name, ref_code, commission_percent, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("referred_by, quantity, subtotal, total_amount, platform_fee, service_fee, payment_status")
        .eq("event_id", eventId)
        .in("payment_status", [...CONFIRMED_PAYMENT_STATUSES]),
    ]);

    if (affiliatesRes.error || ordersRes.error) {
      toast({ title: "Não foi possível carregar os comissionados", variant: "destructive" });
    }
    setAffiliates((affiliatesRes.data ?? []) as ReportAffiliate[]);
    setOrders((ordersRes.data ?? []) as ReportOrder[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // Trocar de evento limpa o formulário
  useEffect(() => {
    setValues(EMPTY);
    setCodeTouched(false);
    clearErrors();
  }, [eventId, clearErrors]);

  const report = useMemo(() => buildReferralReport(orders, affiliates), [orders, affiliates]);

  const update = (field: AffiliateField, raw: string) => {
    let next = { ...values, [field]: raw };
    if (field === "name" && !codeTouched) {
      next = { ...next, refCode: suggestRefCode(raw) }; // código sugerido a partir do nome
    }
    if (field === "refCode") {
      setCodeTouched(true);
      next = { ...next, refCode: normalizeRefCode(raw) };
    }
    setValues(next);
    (["name", "refCode", "commission"] as AffiliateField[]).forEach((f) =>
      revalidate(f, affiliateValidators[f](next)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateAffiliate(values);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("event_affiliates")
      .insert({
        event_id: eventId,
        name: values.name.trim(),
        ref_code: values.refCode,
        commission_percent: parseCommissionPercent(values.commission),
      })
      .select("id, event_id, name, ref_code, commission_percent, created_at")
      .single();
    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrors({ refCode: "Já existe um comissionado com este código neste evento" });
        focusFirstInvalid(formRef.current);
      } else if (error.code === "42501") {
        toast({ title: "Você não tem permissão para cadastrar comissionados neste evento", variant: "destructive" });
      } else {
        toast({ title: "Não foi possível cadastrar o comissionado", variant: "destructive" });
      }
      return;
    }

    setAffiliates((prev) => [...prev, data as ReportAffiliate]);
    setValues(EMPTY);
    setCodeTouched(false);
    clearErrors();
    toast({ title: "Link de indicação criado!", description: "Use \"Copiar Link\" para compartilhar." });
  };

  const copyLink = async (code: string) => {
    const link = buildReferralLink(eventId, code);
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado!", description: link });
    } catch {
      toast({ title: "Não foi possível copiar o link", description: link, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("event_affiliates").delete().eq("id", toDelete.id);
    if (error) {
      toast({ title: "Não foi possível excluir o comissionado", variant: "destructive" });
    } else {
      setAffiliates((prev) => prev.filter((a) => a.id !== toDelete.id));
      toast({
        title: "Comissionado excluído",
        description: "Os pedidos já feitos com este link continuam no relatório como código não cadastrado.",
      });
    }
    setToDelete(null);
  };

  const exportCsv = () => {
    const day = new Date().toISOString().slice(0, 10);
    const slug = normalizeRefCode(selectedEvent?.title ?? "evento") || "evento";
    downloadTextFile(`comissionados-${slug}-${day}.csv`, referralReportToCsv(report), "text/csv;charset=utf-8");
  };

  const { totals } = report;

  return (
    <section aria-labelledby="affiliates-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="affiliates-title" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          Atléticas &amp; Comissionados
        </h2>
        <select
          aria-label="Evento dos comissionados"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          disabled={events.length === 0}
          className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {events.length === 0 && <option value="">Nenhum evento</option>}
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl bg-secondary py-10 text-center text-sm text-muted-foreground">
          Crie um evento para cadastrar atléticas e comissionados.
        </div>
      ) : (
        <>
          {/* Gerador de link */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-4 md:grid-cols-[2fr_2fr_1fr_auto] md:items-start">
              <div>
                <Label htmlFor="affiliate-name" className="text-sm font-semibold">Nome</Label>
                <Input
                  id="affiliate-name"
                  value={values.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Ex.: Atlética Engenharia"
                  autoComplete="off"
                  className={errorClass(errors.name)}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy("affiliate-name", errors.name)}
                />
                <FieldError id="affiliate-name" message={errors.name} />
              </div>
              <div>
                <Label htmlFor="affiliate-code" className="text-sm font-semibold">Código do link</Label>
                <Input
                  id="affiliate-code"
                  value={values.refCode}
                  onChange={(e) => update("refCode", e.target.value)}
                  placeholder="atletica_engenharia"
                  autoComplete="off"
                  className={errorClass(errors.refCode)}
                  aria-invalid={errors.refCode ? true : undefined}
                  aria-describedby={describedBy("affiliate-code", errors.refCode)}
                />
                <FieldError id="affiliate-code" message={errors.refCode} />
              </div>
              <div>
                <Label htmlFor="affiliate-commission" className="text-sm font-semibold">Comissão % (opcional)</Label>
                <Input
                  id="affiliate-commission"
                  value={values.commission}
                  onChange={(e) => update("commission", e.target.value)}
                  placeholder="10"
                  inputMode="decimal"
                  autoComplete="off"
                  className={errorClass(errors.commission)}
                  aria-invalid={errors.commission ? true : undefined}
                  aria-describedby={describedBy("affiliate-commission", errors.commission)}
                />
                <FieldError id="affiliate-commission" message={errors.commission} />
              </div>
              <Button type="submit" variant="gradient" disabled={saving} className="md:mt-6">
                <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {saving ? "Salvando…" : "Gerar link"}
              </Button>
            </form>

            {affiliates.length > 0 && (
              <ul className="divide-y divide-border" aria-label="Comissionados cadastrados">
                {affiliates.map((affiliate) => (
                  <li key={affiliate.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{affiliate.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        ?ref={affiliate.ref_code} • {Number(affiliate.commission_percent)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => copyLink(affiliate.ref_code)}>
                        <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                        Copiar Link
                        <span className="sr-only"> de {affiliate.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${affiliate.name}`}
                        onClick={() => setToDelete(affiliate)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Relatório segmentado */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">Desempenho por indicação</h3>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || totals.orders === 0}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Exportar CSV
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2" role="status" aria-busy="true">
                <span className="sr-only">Carregando relatório…</span>
                <Skeleton aria-hidden="true" className="h-16 w-full" />
                <Skeleton aria-hidden="true" className="h-32 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Pedidos confirmados", String(totals.orders)],
                    ["Ingressos vendidos", String(totals.tickets)],
                    ["Faturamento", money(totals.revenueCents)],
                    ["Comissão estimada", money(totals.commissionCents)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-secondary p-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-bold text-foreground" data-testid={`summary-${label}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Atlética / Comissionado</th>
                        <th className="px-4 py-3 font-medium">Código (?ref=)</th>
                        <th className="px-4 py-3 text-right font-medium">Pedidos Confirmados</th>
                        <th className="px-4 py-3 text-right font-medium">Ingressos Vendidos</th>
                        <th className="px-4 py-3 text-right font-medium">Faturamento Gerado (R$)</th>
                        <th className="px-4 py-3 text-right font-medium">Comissão Estimada (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.rows.map((row) => (
                        <tr key={row.code ?? "direct"} data-testid={`row-${row.code ?? "direct"}`}>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.name}
                            {row.kind === "unregistered" && (
                              <Badge variant="secondary" className="ml-2">não cadastrado</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.code ?? "—"}</td>
                          <td className="px-4 py-3 text-right">{row.orders}</td>
                          <td className="px-4 py-3 text-right">{row.tickets}</td>
                          <td className="px-4 py-3 text-right">{money(row.revenueCents)}</td>
                          <td className="px-4 py-3 text-right">
                            {money(row.commissionCents)}
                            {row.kind === "registered" && row.commissionPercent > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">({row.commissionPercent}%)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border font-semibold" data-testid="row-total">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right">{totals.orders}</td>
                        <td className="px-4 py-3 text-right">{totals.tickets}</td>
                        <td className="px-4 py-3 text-right">{money(totals.revenueCents)}</td>
                        <td className="px-4 py-3 text-right">{money(totals.commissionCents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Considera apenas pedidos confirmados/pagos. Faturamento = valor dos ingressos (sem a taxa da plataforma);
                  comissão = faturamento × %. Cortesias não entram.
                </p>
              </>
            )}
          </div>
        </>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comissionado?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} deixa de ter nome e comissão cadastrados. Os pedidos já feitos com o link continuam no
              relatório como código não cadastrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
