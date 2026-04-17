import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 [WEBHOOK] Asaas webhook invoked");

    // Optional signature verification
    const expectedSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
    if (expectedSecret) {
      const receivedToken = req.headers.get("asaas-access-token") || req.headers.get("Asaas-Access-Token");
      console.log("🔐 [WEBHOOK] Token check. Expected set:", !!expectedSecret, "Received present:", !!receivedToken);
      if (receivedToken !== expectedSecret) {
        console.error("❌ [WEBHOOK] Invalid webhook secret token");
        return new Response(JSON.stringify({ received: true, error: "invalid token" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const event = body.event;
    console.log(`📩 [WEBHOOK] Event: ${event}`);

    // Only process payment confirmations
    if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
      console.log(`⏭️ [WEBHOOK] Ignoring event: ${event}`);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.payment?.id;
    const externalReference = body.payment?.externalReference;
    if (!paymentId) {
      console.error("❌ [WEBHOOK] No payment.id in payload");
      return new Response(JSON.stringify({ received: true, error: "no payment id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`💳 [WEBHOOK] Processing payment: ${paymentId} | externalReference: ${externalReference || "none"}`);

    // CRITICAL: Use SERVICE_ROLE_KEY to bypass RLS for UPDATE
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to find order by transaction_id (Asaas payment id)
    let { data: order, error: findError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, quantity, buyer_name, buyer_email, event_id")
      .eq("transaction_id", paymentId)
      .maybeSingle();

    // Fallback: find by externalReference (order id) if transaction_id wasn't linked yet
    if ((!order || findError) && externalReference) {
      console.log(`🔍 [WEBHOOK] Fallback lookup by externalReference: ${externalReference}`);
      const fallback = await supabaseAdmin
        .from("orders")
        .select("id, payment_status, quantity, buyer_name, buyer_email, event_id")
        .eq("id", externalReference)
        .maybeSingle();
      order = fallback.data;
      findError = fallback.error;

      // Backfill transaction_id so future events match directly
      if (order) {
        await supabaseAdmin
          .from("orders")
          .update({ transaction_id: paymentId })
          .eq("id", order.id);
        console.log(`🔗 [WEBHOOK] Backfilled transaction_id for order ${order.id}`);
      }
    }

    if (!order) {
      console.error("❌ [WEBHOOK] Order not found for payment:", paymentId, findError);
      return new Response(JSON.stringify({ received: true, error: "order not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already confirmed
    if (order.payment_status === "confirmed" || order.payment_status === "paid") {
      console.log(`✅ [WEBHOOK] Order ${order.id} already confirmed, skipping`);
      return new Response(JSON.stringify({ received: true, already_confirmed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔄 [WEBHOOK] Updating order ${order.id} from '${order.payment_status}' → 'confirmed'`);

    // Update order status to confirmed
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "confirmed" })
      .eq("id", order.id);

    if (updateError) {
      console.error("❌ [WEBHOOK] Failed to update order:", updateError);
    } else {
      console.log(`✅ [WEBHOOK] Order ${order.id} updated to confirmed`);
    }

    // Send confirmation email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const { data: eventData } = await supabaseAdmin
        .from("events")
        .select("title, event_date, event_time, venue")
        .eq("id", order.event_id)
        .single();

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎫 EasyTicket</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Pagamento confirmado!</p>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Olá, ${order.buyer_name}! 🎉</h2>
            <p style="color: #64748b; margin: 0 0 24px; font-size: 15px;">
              Seu pagamento para <strong>${eventData?.title || "o evento"}</strong> foi confirmado!
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #64748b;">📅 Data</td><td style="padding: 8px 0; color: #1e293b; text-align: right; font-weight: 600;">${eventData?.event_date || ""} às ${eventData?.event_time || ""}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;">📍 Local</td><td style="padding: 8px 0; color: #1e293b; text-align: right; font-weight: 600;">${eventData?.venue || ""}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;">🎫 Ingressos</td><td style="padding: 8px 0; color: #1e293b; text-align: right; font-weight: 600;">${order.quantity}x</td></tr>
              </table>
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">Acesse o app para ver seu QR Code.</p>
          </div>
          <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
          </div>
        </div>
      `;

      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "EasyTicket <contato@easyticket.dev.br>",
            to: [order.buyer_email],
            subject: `🎫 Pagamento confirmado - ${eventData?.title || "seu evento"}!`,
            html: emailHtml,
          }),
        });
        const resendBody = await resendRes.text();
        console.log(`📧 Resend response [${resendRes.status}]:`, resendBody);
      } catch (emailErr) {
        console.error("❌ Email error:", emailErr);
      }
    }

    return new Response(JSON.stringify({ received: true, order_id: order.id, status: "confirmed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    // Always return 200 to prevent Asaas retries
    return new Response(JSON.stringify({ received: true, error: "processing error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
