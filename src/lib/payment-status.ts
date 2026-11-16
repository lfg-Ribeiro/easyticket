// Single rule for "the money is in" across checkout, the "Já fiz o pagamento"
// button and the post-purchase polling screen.
//
// RECEIVED_IN_CASH is the status Asaas sets when a PIX charge is written off
// manually in the Asaas dashboard, so it must count as paid like RECEIVED and
// CONFIRMED.
export const PAID_ASAAS_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"] as const;

export type PaymentCheckResult = {
  status?: string | null;
  asaas_status?: string | null;
  confirmed?: boolean | null;
};

export function isPaymentConfirmed(data?: PaymentCheckResult | null): boolean {
  if (!data) return false;
  if (data.confirmed === true) return true;

  return [data.status, data.asaas_status].some(
    (value) =>
      typeof value === "string" &&
      PAID_ASAAS_STATUSES.includes(value.toUpperCase() as (typeof PAID_ASAAS_STATUSES)[number]),
  );
}
