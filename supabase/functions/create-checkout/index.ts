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
    let isNewUser = false;
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === buyer_email.toLowerCase()
      );

      if (existingUser) {
        guestUserId = existingUser.id;
      } else {
        isNewUser = true;
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

          // E-mail 1: Magic link for account access (fired in parallel with ticket email below)
          const magicLinkPromise = supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: buyer_email,
          });
          magicLinkPromise.then(({ error }) => {
            if (error) console.error("Magic link error:", error);
            else console.log(`🔑 [ACCESS EMAIL] Magic link sent to ${buyer_email}`);
          });
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
        payment_status: payment_method === "card" ? "confirmed" : "pending",
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

    // ── E-mail 2: Ticket confirmation via Resend ──
    let emailSent = false;
    let emailError: string | null = null;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const ticketUrl = supabaseUrl ? `${supabaseUrl.replace('.supabase.co', '')}/tickets` : "https://easyticket.com/tickets";

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎫 EasyTicket</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Seu acesso está garantido!</p>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Olá, ${buyer_name}! 🎉</h2>
          <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Sua compra para <strong style="color: #1e293b;">${event.title}</strong> foi confirmada com sucesso.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">📅 Data</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event.event_date} às ${event.event_time}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">📍 Local</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event.venue}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🏙️ Endereço</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${event.location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🎫 Ingressos</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${quantity}x</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🆔 Transação</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${transactionId}</td>
              </tr>
            </table>
          </div>
          <a href="${ticketUrl}" style="display: block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; text-align: center;">
            Ver Meu QR Code →
          </a>
          ${isNewUser ? `
          <p style="color: #64748b; font-size: 13px; margin-top: 20px; text-align: center; line-height: 1.5;">
            💡 Uma conta foi criada automaticamente com este e-mail. Verifique sua caixa de entrada para definir sua senha e acessar seus ingressos a qualquer momento.
          </p>
          ` : ''}
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
        </div>
      </div>
    `;

    console.log("📧 [RESEND DEBUG] Key exists:", resendApiKey ? "SIM" : "NÃO");
    if (resendApiKey) {
      try {
        console.log(`📧 [RESEND] Sending to: ${buyer_email}, From: EasyTicket <onboarding@resend.dev>`);
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "EasyTicket <onboarding@resend.dev>",
            to: [buyer_email],
            subject: `🎫 Seu acesso ao evento ${event.title} está garantido!`,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
          const resendData = await resendRes.json();
          console.log("✅ Resend email sent to:", buyer_email, "ID:", resendData.id);
        } else {
          const errBody = await resendRes.text();
          emailError = `[${resendRes.status}] ${errBody}`;
          console.error("[RESEND ERROR]:", resendRes.status, errBody);
          if (errBody.includes("domain")) {
            console.error("[RESEND ERROR]: Domain verification issue. Use onboarding@resend.dev for free accounts.");
          }
          if (errBody.includes("403") || errBody.includes("Forbidden")) {
            console.error("[RESEND ERROR]: 403 Forbidden - check API key permissions and plan limits.");
          }
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    } else {
      console.log("📧 [MOCK EMAIL - TICKET] Would send to:", buyer_email);
      console.log("Subject:", `🎫 Seu acesso ao evento ${event.title} está garantido!`);
    }

    return new Response(
      JSON.stringify({
        order,
        tickets: createdTickets,
        transaction_id: transactionId,
        email_sent: emailSent,
        email_error: emailError,
        guest_user_id: guestUserId,
        is_new_user: isNewUser,
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
