import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      amount,
      customer_cpf,
      customer_name,
      customer_email,
      holder_name,
      number,
      expiry_month,
      expiry_year,
      ccv,
      event_id,
      quantity,
      buyer_cpf,
      order_id,
    } = await req.json();

    console.log("💳 [CARD] Received request. order_id:", order_id, "amount:", amount, "email:", customer_email);

    if (!amount || !customer_cpf || !customer_name || !holder_name || !number || !expiry_month || !expiry_year || !ccv) {
      return new Response(
        JSON.stringify({ error: "Missing required fields for card payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const isProduction = Deno.env.get("ASAAS_PRODUCTION") === "true";
    const baseUrl = isProduction
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    if (!asaasApiKey) {
      console.log("💳 [MOCK CARD] ASAAS_API_KEY not configured. Simulating card payment.");

      // ALWAYS update order to confirmed
      if (order_id) {
        const { error: updateErr } = await supabaseAdmin
          .from("orders")
          .update({ payment_status: "confirmed" })
          .eq("id", order_id);
        console.log("✅ [MOCK] Order update result. Error:", updateErr || "NONE");
      }

      const emailResult = order_id ? await sendConfirmationEmail(supabaseAdmin, order_id) : { sent: false, error: "no order_id" };

      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          payment_id: `pay_card_mock_${Date.now().toString(36)}`,
          status: "CONFIRMED",
          confirmed: true,
          email_success: emailResult.sent,
          email_error: emailResult.error || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create or find customer
    const cleanCpf = customer_cpf.replace(/\D/g, "");
    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: asaasApiKey },
      body: JSON.stringify({
        name: customer_name,
        cpfCnpj: cleanCpf,
        email: customer_email || undefined,
      }),
    });

    const customerData = await customerRes.json();
    const customerId = customerData.id;
    if (!customerId) {
      console.error("Asaas customer error:", customerData);
      return new Response(
        JSON.stringify({ error: "Failed to create/find customer", details: customerData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create credit card payment
    const today = new Date().toISOString().split("T")[0];
    const cleanCardNumber = number.replace(/\D/g, "");

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: asaasApiKey },
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: Number(amount),
        dueDate: today,
        description: "Ingresso EasyTicket",
        creditCard: {
          holderName: holder_name,
          number: cleanCardNumber,
          expiryMonth: expiry_month,
          expiryYear: expiry_year,
          ccv: ccv,
        },
        creditCardHolderInfo: {
          name: customer_name,
          cpfCnpj: cleanCpf,
          email: customer_email || undefined,
          postalCode: "01001000",
          addressNumber: "0",
          phone: "11999999999",
        },
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok || !paymentData.id) {
      console.error("Asaas card payment error:", paymentData);
      const errorMsg = paymentData.errors?.[0]?.description || "Card payment failed";
      return new Response(
        JSON.stringify({ error: errorMsg, details: paymentData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`💳 Card payment ${paymentData.id} status: ${paymentData.status}`);

    const isConfirmed = paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED";

    // 3. ALWAYS update order status when payment succeeds (regardless of CONFIRMED vs PENDING)
    let emailResult = { sent: false, error: "skipped" };
    if (order_id) {
      const newStatus = isConfirmed ? "confirmed" : "pending";
      const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: newStatus, transaction_id: paymentData.id })
        .eq("id", order_id);
      console.log(`✅ Order ${order_id} updated to '${newStatus}'. Error:`, updateErr || "NONE");

      // Send email immediately if confirmed
      if (isConfirmed) {
        emailResult = await sendConfirmationEmail(supabaseAdmin, order_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        status: paymentData.status,
        confirmed: isConfirmed,
        email_success: emailResult.sent,
        email_error: emailResult.error || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Card payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendConfirmationEmail(
  supabaseAdmin: any,
  orderId: string
): Promise<{ sent: boolean; error: string }> {
  try {
    console.log("📧 [CARD EMAIL] Starting email flow for order:", orderId);

    // Fetch order + event data
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("*, events(*)")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) {
      console.error("❌ [CARD EMAIL] Order fetch failed:", fetchErr);
      return { sent: false, error: `Order not found: ${fetchErr?.message ?? "unknown"}` };
    }

    const event = (order as any).events;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    console.log("📧 [CARD EMAIL] RESEND_API_KEY exists:", resendApiKey ? "SIM" : "NÃO");
    const o = order as any;
    console.log("📧 [CARD EMAIL] Tentando enviar email para:", o.buyer_email);
    console.log("📧 [CARD EMAIL] Event:", event?.title, "| Qty:", o.quantity);

    if (!resendApiKey) {
      console.log("📧 [CARD EMAIL MOCK] Sem RESEND_API_KEY. Would send to:", (order as any).buyer_email);
      return { sent: false, error: "RESEND_API_KEY not configured" };
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎫 EasyTicket</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Pagamento confirmado!</p>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Olá, ${order.buyer_name}! 🎉</h2>
          <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Seu pagamento via cartão para <strong style="color: #1e293b;">${event?.title || "o evento"}</strong> foi confirmado!
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">📅 Data</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event?.event_date || ""} às ${event?.event_time || ""}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">📍 Local</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event?.venue || ""}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">🎫 Ingressos</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${order.quantity}x</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">🆔 Transação</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${order.transaction_id || ""}</td></tr>
            </table>
          </div>
          <a href="#" style="display: block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; text-align: center;">
            Ver Meu QR Code →
          </a>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
        </div>
      </div>
    `;

    const resendBody = {
      from: "EasyTicket <onboarding@resend.dev>",
      to: [order.buyer_email],
      subject: `🎫 Pagamento confirmado - ${event?.title || "seu evento"}!`,
      html: emailHtml,
    };

    console.log("📧 [CARD EMAIL] Resend payload:", JSON.stringify({ to: resendBody.to, subject: resendBody.subject }));

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    });

    const resendText = await resendRes.text();
    console.log("📧 [CARD EMAIL] Resend response status:", resendRes.status, "body:", resendText);

    if (resendRes.ok) {
      const resendData = JSON.parse(resendText);
      console.log("✅ [CARD EMAIL] Resend sent successfully. ID:", resendData.id);
      return { sent: true, error: "" };
    } else {
      console.error("❌ [CARD EMAIL RESEND ERROR]:", resendRes.status, resendText);
      return { sent: false, error: `Resend ${resendRes.status}: ${resendText}` };
    }
  } catch (emailErr) {
    console.error("❌ [CARD EMAIL] Exception:", emailErr);
    return { sent: false, error: String(emailErr) };
  }
}
