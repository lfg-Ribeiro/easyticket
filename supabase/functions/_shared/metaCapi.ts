// Meta Conversions API (CAPI) helper. Never throws: Meta instability must not block ticket confirmation.
// deno-lint-ignore-file no-explicit-any

const GRAPH_URL = "https://graph.facebook.com/v21.0";

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashed(value?: string | null): Promise<string[] | undefined> {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return v ? [await sha256(v)] : undefined;
}

function normalizePhone(phone?: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
}

/**
 * Sends a `Purchase` event for a confirmed, paid order. Uses order.id as event_id and
 * atomically claims `meta_purchase_sent_at` so webhook retries never send twice.
 */
export async function sendMetaPurchase(supabaseAdmin: any, orderId: string): Promise<void> {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, event_id, buyer_name, buyer_email, buyer_cpf, buyer_phone, quantity, subtotal, total_amount, payment_status, created_at, meta_fbp, meta_fbc, client_ip, client_user_agent, meta_purchase_sent_at")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.meta_purchase_sent_at) return;
    if (order.payment_status !== "confirmed" && order.payment_status !== "paid") return;

    const { data: event } = await supabaseAdmin
      .from("events").select("id, title, meta_pixel_id").eq("id", order.event_id).maybeSingle();
    if (!event?.meta_pixel_id) return;
    const { data: secret } = await supabaseAdmin
      .from("event_meta_secrets").select("capi_token").eq("event_id", event.id).maybeSingle();
    if (!secret?.capi_token) return;

    // Skip courtesy-only orders.
    const { count: paidTickets } = await supabaseAdmin
      .from("tickets").select("id", { count: "exact", head: true })
      .eq("order_id", order.id).eq("is_complimentary", false);
    if (!paidTickets) return;

    // Claim (dedupe across concurrent webhook/status checks).
    const { data: claimed } = await supabaseAdmin
      .from("orders").update({ meta_purchase_sent_at: new Date().toISOString() })
      .eq("id", order.id).is("meta_purchase_sent_at", null).select("id");
    if (!claimed?.length) return;

    const [first, ...rest] = (order.buyer_name || "").trim().split(/\s+/);
    const cpf = (order.buyer_cpf || "").replace(/\D/g, "");
    const user_data: Record<string, unknown> = {
      em: await hashed(order.buyer_email),
      ph: await hashed(normalizePhone(order.buyer_phone)),
      fn: await hashed(first),
      ln: await hashed(rest.join(" ")),
      external_id: cpf ? [await sha256(cpf)] : undefined,
      client_ip_address: order.client_ip || undefined,
      client_user_agent: order.client_user_agent || undefined,
      fbp: order.meta_fbp || undefined,
      fbc: order.meta_fbc || undefined,
    };
    Object.keys(user_data).forEach((k) => user_data[k] === undefined && delete user_data[k]);

    const payload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: order.id,
        action_source: "website",
        event_source_url: `https://www.easyticket.dev.br/event/${event.id}`,
        user_data,
        custom_data: {
          currency: "BRL",
          value: Number(order.total_amount ?? order.subtotal ?? 0),
          content_ids: [event.id],
          content_name: event.title,
          content_type: "product",
          num_items: order.quantity,
          order_id: order.id,
        },
      }],
    };

    const res = await fetch(
      `${GRAPH_URL}/${encodeURIComponent(event.meta_pixel_id)}/events?access_token=${encodeURIComponent(secret.capi_token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const body = await res.text();
    console.log(`📈 [META CAPI] Purchase order ${order.id} → ${res.status}: ${body.slice(0, 300)}`);
    if (!res.ok) {
      // Release claim so a later confirmation path can retry.
      await supabaseAdmin.from("orders").update({ meta_purchase_sent_at: null }).eq("id", order.id);
    }
  } catch (err) {
    console.error("❌ [META CAPI] Purchase send failed (ignored):", err);
  }
}
