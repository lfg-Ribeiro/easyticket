import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { amount, customer_cpf, customer_name } = await req.json();

    if (!amount || !customer_cpf || !customer_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: amount, customer_cpf, customer_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const isProduction = Deno.env.get("ASAAS_PRODUCTION") === "true";
    const baseUrl = isProduction
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    if (asaasApiKey) {
      // ── Real Asaas Integration ──

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
        }),
      });

      const customerData = await customerRes.json();
      // Asaas returns existing customer if cpf already exists (or creates new)
      const customerId = customerData.id;
      if (!customerId) {
        console.error("Asaas customer error:", customerData);
        return new Response(
          JSON.stringify({ error: "Failed to create/find customer in Asaas", details: customerData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Create PIX payment
      const today = new Date().toISOString().split("T")[0];

      const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: Number(amount),
          dueDate: today,
          description: "Ingresso EasyTicket",
        }),
      });

      const paymentData = await paymentRes.json();
      if (!paymentRes.ok || !paymentData.id) {
        console.error("Asaas payment error:", paymentData);
        return new Response(
          JSON.stringify({ error: "Failed to create payment in Asaas", details: paymentData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Get PIX QR Code
      const qrRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: asaasApiKey },
      });

      const qrData = await qrRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: paymentData.id,
          status: paymentData.status,
          pix_code: qrData.payload || "",
          qr_code_image: qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : null,
          expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mock / Simulation Mode ──
    console.log("💰 [MOCK PIX] ASAAS_API_KEY not configured. Simulating PIX payment:");
    console.log(JSON.stringify({ amount, customer_cpf, customer_name }, null, 2));

    const mockPaymentId = `pay_mock_${Date.now().toString(36)}`;
    const mockPixCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}520400005303986540${Number(amount).toFixed(2)}5802BR5913EASYTICKET6009SAO_PAULO62070503***6304ABCD`;

    return new Response(
      JSON.stringify({
        success: true,
        mock: true,
        payment_id: mockPaymentId,
        status: "PENDING",
        pix_code: mockPixCode,
        qr_code_image: null,
        expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("PIX payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
