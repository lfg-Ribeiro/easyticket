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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is authenticated
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error("❌ [VALIDATE] Auth failed:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔍 [VALIDATE] User:", user.email);

    const { qr_code } = await req.json();
    if (!qr_code) {
      return new Response(
        JSON.stringify({ error: "QR code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔍 [VALIDATE] Scanning qr_code:", qr_code);

    // Find ticket by QR code using admin client (bypasses RLS)
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select(`
        *,
        events:event_id (
          id,
          title,
          organizer_id
        ),
        orders:order_id (
          buyer_name,
          buyer_email,
          payment_status
        )
      `)
      .eq("qr_code", qr_code)
      .maybeSingle();

    console.log("🔍 [VALIDATE] Ticket found:", ticket ? ticket.id : "NONE", "Error:", ticketError);

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({
          status: "invalid",
          message: "Ingresso Inválido",
          description: "Este QR Code não corresponde a nenhum ingresso.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify organizer owns this event OR is super admin
    const isSuperAdmin = user.email === "lribeiro@easyticket.com";
    const isOrganizer = ticket.events?.organizer_id === user.id;

    if (!isOrganizer && !isSuperAdmin) {
      console.error("❌ [VALIDATE] Not authorized. User:", user.id, "Organizer:", ticket.events?.organizer_id);
      return new Response(
        JSON.stringify({ error: "Not authorized for this event" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if payment is confirmed
    const orderPaymentStatus = (ticket as any).orders?.payment_status;
    if (orderPaymentStatus && orderPaymentStatus !== 'confirmed' && orderPaymentStatus !== 'paid') {
      return new Response(
        JSON.stringify({
          status: "invalid",
          message: "Pagamento Pendente",
          description: "Este ingresso está vinculado a um pedido com pagamento não confirmado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already used
    if (ticket.check_in_status === "used") {
      return new Response(
        JSON.stringify({
          status: "used",
          message: "Atenção: Ingresso já utilizado!",
          description: `Check-in realizado em ${new Date(ticket.checked_in_at).toLocaleString("pt-BR")}`,
          ticket: {
            holder_name: ticket.holder_name,
            holder_email: ticket.holder_email,
            event_title: ticket.events?.title,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as used
    const { error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        check_in_status: "used",
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (updateError) {
      console.error("❌ [VALIDATE] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update ticket" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [VALIDATE] Check-in success for ticket:", ticket.id);

    return new Response(
      JSON.stringify({
        status: "valid",
        message: "Check-in Realizado!",
        description: "Ingresso validado com sucesso.",
        ticket: {
          holder_name: ticket.holder_name,
          holder_email: ticket.holder_email,
          event_title: ticket.events?.title,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ [VALIDATE] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
