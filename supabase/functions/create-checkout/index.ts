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

    // ── Guest Checkout: Silent user creation ──
    let guestUserId: string | null = null;
    try {
      // Check if user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === buyer_email.toLowerCase()
      );

      if (existingUser) {
        guestUserId = existingUser.id;
      } else {
        // Create user silently with a random password
        const tempPassword = crypto.randomUUID();
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: buyer_email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: buyer_name },
        });

        if (createError) {
          console.error("Silent user creation error:", createError);
        } else if (newUser?.user) {
          guestUserId = newUser.user.id;

          // E-mail 1: Send magic link so user can set password / access account
          const { error: magicError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: buyer_email,
          });
          if (magicError) {
            console.error("Magic link generation error:", magicError);
          } else {
            console.log(`🔑 [ACCESS EMAIL] Magic link generated for ${buyer_email}`);
          }
        }
      }
    } catch (userErr) {
      console.error("Guest user flow error:", userErr);
    }

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
    let selectedBatchId = batch_id || null;
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
    } else {
      const { data: batches } = await supabaseAdmin
        .from("ticket_batches")
        .select("*")
        .eq("event_id", event_id)
        .gt("available_quantity", 0)
        .order("price", { ascending: true })
        .limit(1);

      if (batches && batches.length > 0) {
        batchPrice = Number(batches[0].price);
        selectedBatchId = batches[0].id;
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
        batch_id: selectedBatchId,
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

    // Update available quantity
    if (selectedBatchId) {
      const { data: currentBatch } = await supabaseAdmin
        .from("ticket_batches")
        .select("available_quantity")
        .eq("id", selectedBatchId)
        .single();

      if (currentBatch) {
        await supabaseAdmin
          .from("ticket_batches")
          .update({ available_quantity: Math.max(0, currentBatch.available_quantity - quantity) })
          .eq("id", selectedBatchId);
      }
    }

    // ── E-mail 2: Ticket confirmation (mock/Resend) ──
    let emailSent = false;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const emailData = {
      to: buyer_email,
      subject: `Seu acesso ao evento ${event.title} está garantido!`,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      eventVenue: event.venue,
      eventLocation: event.location,
      holderName: buyer_name,
      quantity,
      transactionId,
      ticketIds: createdTickets?.map((t: any) => t.id) || [],
    };

    if (resendApiKey) {
      try {
        const { default: { Resend } } = await import("npm:resend@2.0.0");
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: "EasyTicket <noreply@easyticket.com>",
          to: [buyer_email],
          subject: emailData.subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Seu acesso ao evento ${event.title} está garantido! 🎉</h1>
              <p>Olá <strong>${buyer_name}</strong>,</p>
              <p>Sua compra foi confirmada com sucesso!</p>
              <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p><strong>📅 Data:</strong> ${event.event_date} às ${event.event_time}</p>
                <p><strong>📍 Local:</strong> ${event.venue}, ${event.location}</p>
                <p><strong>🎫 Quantidade:</strong> ${quantity} ingresso(s)</p>
                <p><strong>🆔 Transação:</strong> ${transactionId}</p>
              </div>
              <a href="https://easyticket.com/tickets" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Ver Meus Ingressos
              </a>
            </div>
          `,
        });
        emailSent = true;
        console.log("✅ Email sent to:", buyer_email);
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    } else {
      console.log("📧 [MOCK EMAIL - TICKET] Email would be sent:");
      console.log(JSON.stringify(emailData, null, 2));
    }

    return new Response(
      JSON.stringify({
        order,
        tickets: createdTickets,
        transaction_id: transactionId,
        email_sent: emailSent,
        email_data: emailData,
        guest_user_id: guestUserId,
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
