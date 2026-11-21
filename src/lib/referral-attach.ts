import { supabase } from "@/integrations/supabase/client";
import { getStoredReferral } from "@/lib/referral";

/**
 * Grava a indicação ativa em orders.referred_by logo depois do create-checkout
 * (RPC attach_order_referral). Nunca bloqueia a compra: se falhar, o pedido segue sem indicação.
 * Devolve true quando a indicação foi gravada.
 */
export async function attachOrderReferral(orderId: string | undefined, eventId: string): Promise<boolean> {
  const code = getStoredReferral(eventId);
  if (!orderId || !code) return false;

  try {
    const { data, error } = await supabase.rpc("attach_order_referral", {
      p_order_id: orderId,
      p_referred_by: code,
    });
    if (error) {
      console.warn("attach_order_referral falhou:", error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.warn("attach_order_referral falhou:", err);
    return false;
  }
}

/** Nome público do comissionado cadastrado (sem expor a comissão); null se não houver. */
export async function fetchAffiliateName(eventId: string, refCode: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_affiliate_name", {
      p_event_id: eventId,
      p_ref_code: refCode,
    });
    return error || !data ? null : String(data);
  } catch {
    return null;
  }
}
