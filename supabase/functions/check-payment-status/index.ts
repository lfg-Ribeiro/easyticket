import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, order_id } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: "payment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const isProduction = Deno.env.get("ASAAS_PRODUCTION") === "true";
    const baseUrl = isProduction
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    if (!asaasApiKey) {
      // Mock mode: simulate confirmed after a few calls
      console.log("⚡ [MOCK] check-payment-status called for:", payment_id);
      return new Response(
        JSON.stringify({ status: "CONFIRMED", mock: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query Asaas for payment status
    const asaasRes = await fetch(`${baseUrl}/payments/${payment_id}`, {
      headers: { access_token: asaasApiKey },
    });

    if (!asaasRes.ok) {
      const errText = await asaasRes.text();
      console.error(`Asaas status check error [${asaasRes.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: "Failed to check Asaas status", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentData = await asaasRes.json();
    const asaasStatus = paymentData.status; // PENDING, RECEIVED, CONFIRMED, OVERDUE, etc.
    console.log(`💳 Asaas payment ${payment_id} status: ${asaasStatus}`);

    const isConfirmed = asaasStatus === "RECEIVED" || asaasStatus === "CONFIRMED";

    // If confirmed and we have an order_id, update the order and send email
    if (isConfirmed && order_id) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Update order status
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: "confirmed" })
        .eq("id", order_id);

      if (updateError) {
        console.error("Failed to update order:", updateError);
      } else {
        console.log(`✅ Order ${order_id} updated to confirmed`);
      }

      // Fetch order + event data for email
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("*, events(*)")
        .eq("id", order_id)
        .single();

      // Send ticket email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey && order) {
        const event = (order as any).events;
        const emailHtml = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎫 EasyTicket</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Pagamento confirmado!</p>
            </div>
            <div style="padding: 32px 24px;">
              <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Olá, ${order.buyer_name}! 🎉</h2>
              <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
                Seu pagamento PIX para <strong style="color: #1e293b;">${event?.title || "o evento"}</strong> foi confirmado!
              </p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">📅 Data</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event?.event_date || ""} às ${event?.event_time || ""}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">📍 Local</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event?.venue || ""}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🎫 Ingressos</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${order.quantity}x</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🆔 Transação</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${order.transaction_id || ""}</td>
                  </tr>
                </table>
              </div>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "")}/tickets" style="display: block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; text-align: center;">
                Ver Meu QR Code →
              </a>
            </div>
            <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
            </div>
          </div>
        `;

        try {
          console.log(`📧 Sending Resend email to: ${order.buyer_email}`);
          console.log(`📧 From: EasyTicket <contato@easyticket.dev.br>`);
          console.log(`📧 Subject: 🎫 Pagamento confirmado - ${event?.title}`);

          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "EasyTicket <contato@easyticket.dev.br>",
              to: [order.buyer_email],
              subject: `🎫 Pagamento confirmado - ${event?.title || "seu evento"}!`,
              html: emailHtml,
            }),
          });

        if (resendRes.ok) {
            const resendData = await resendRes.json();
            console.log("✅ Resend email sent successfully. ID:", resendData.id);
          } else {
            const errBody = await resendRes.text();
            console.error("[RESEND ERROR]:", resendRes.status, errBody);
            if (errBody.includes("domain")) {
              console.error("[RESEND ERROR]: Domain verification issue. Use onboarding@resend.dev for free accounts.");
            }
            if (errBody.includes("403") || errBody.includes("Forbidden")) {
              console.error("[RESEND ERROR]: 403 Forbidden - check API key permissions and plan limits.");
            }
          }
        } catch (emailErr) {
          console.error("❌ Email send exception:", emailErr);
        }
      } else {
        if (!resendApiKey) console.log("⚠️ RESEND_API_KEY not configured, skipping email");
      }
    }

    return new Response(
      JSON.stringify({
        status: isConfirmed ? "confirmed" : asaasStatus.toLowerCase(),
        asaas_status: asaasStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-payment-status error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
