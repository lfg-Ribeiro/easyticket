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
    const {
      amount,
      customer_cpf,
      customer_name,
      customer_email,
      // Card data
      holder_name,
      number,
      expiry_month,
      expiry_year,
      ccv,
      // Order data
      event_id,
      quantity,
      buyer_cpf,
    } = await req.json();

    if (!amount || !customer_cpf || !customer_name || !holder_name || !number || !expiry_month || !expiry_year || !ccv) {
      return new Response(
        JSON.stringify({ error: "Missing required fields for card payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const isProduction = Deno.env.get("ASAAS_PRODUCTION") === "true";
    const baseUrl = isProduction
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    if (!asaasApiKey) {
      // Mock mode
      console.log("💳 [MOCK CARD] ASAAS_API_KEY not configured. Simulating card payment.");
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          payment_id: `pay_card_mock_${Date.now().toString(36)}`,
          status: "CONFIRMED",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create or find customer
    const cleanCpf = customer_cpf.replace(/\D/g, "");
    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
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
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
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

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        status: paymentData.status,
        confirmed: isConfirmed,
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
