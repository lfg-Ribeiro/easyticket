import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, batch_id, buyer_name, buyer_email, buyer_cpf, quantity, payment_method } = await req.json();

    if (!event_id || !buyer_name || !buyer_email || !quantity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get event and batch info
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let batchPrice = 0;
    if (batch_id) {
      const { data: batch } = await supabaseAdmin
        .from("ticket_batches")
        .select("*")
        .eq("id", batch_id)
        .single();

      if (batch) {
        if (batch.available_quantity < quantity) {
          return new Response(
            JSON.stringify({ error: "Not enough tickets available" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        batchPrice = Number(batch.price);
      }
    }

    const subtotal = batchPrice * quantity;
    const serviceFee = event.fee_absorbed ? 0 : subtotal * 0.05;
    const totalAmount = subtotal + serviceFee;

    const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        event_id,
        buyer_name,
        buyer_email,
        buyer_cpf: buyer_cpf || null,
        quantity,
        subtotal,
        service_fee: serviceFee,
        total_amount: totalAmount,
        payment_method: payment_method || "pix",
        payment_status: "confirmed",
        transaction_id: transactionId,
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order error:", orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create individual tickets
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const qrCode = `TICKET-${order.id.slice(0, 8)}-${i + 1}-${Date.now().toString(36)}`.toUpperCase();
      tickets.push({
        order_id: order.id,
        event_id,
        batch_id: batch_id || null,
        qr_code: qrCode,
        holder_name: buyer_name,
        holder_email: buyer_email,
        check_in_status: "valid",
      });
    }

    const { data: createdTickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .insert(tickets)
      .select();

    if (ticketsError) {
      console.error("Tickets error:", ticketsError);
      return new Response(
        JSON.stringify({ error: "Failed to create tickets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update available quantity if batch
    if (batch_id) {
      const { data: currentBatch } = await supabaseAdmin
        .from("ticket_batches")
        .select("available_quantity")
        .eq("id", batch_id)
        .single();

      if (currentBatch) {
        await supabaseAdmin
          .from("ticket_batches")
          .update({ available_quantity: Math.max(0, currentBatch.available_quantity - quantity) })
          .eq("id", batch_id);
      }
    }

    return new Response(
      JSON.stringify({
        order,
        tickets: createdTickets,
        transaction_id: transactionId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
