import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Easy${result}!`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, batch_id, buyer_name, buyer_email, buyer_cpf, buyer_phone, quantity, payment_method } = await req.json();

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
    const tempPassword = generateTempPassword(); // single source of truth

    try {
      // Try to create user directly — if exists, Supabase returns an error
      const cleanCpf = buyer_cpf ? buyer_cpf.replace(/\D/g, "") : null;
      const cleanPhone = buyer_phone ? buyer_phone.replace(/\D/g, "") : null;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: buyer_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: buyer_name,
          cpf: cleanCpf || undefined,
          phone: cleanPhone || undefined,
        },
      });

      if (createError) {
        // User already exists — find them
        console.log(`👤 [GUEST] User ${buyer_email} already exists, finding...`);
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === buyer_email.toLowerCase()
        );
        if (existingUser) {
          guestUserId = existingUser.id;
        }
      } else if (newUser?.user) {
        isNewUser = true;
        guestUserId = newUser.user.id;
        console.log(`🔑 [GUEST] Created user ${buyer_email}`);

        // Fire-and-forget: send branded welcome email with recovery link
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ email: buyer_email, name: buyer_name }),
          }).then(r => r.json()).then(d => console.log("📧 Welcome email result:", d)).catch(e => console.error("📧 Welcome email fire-and-forget error:", e));
        } catch (welcomeErr) {
          console.error("📧 Welcome email call error:", welcomeErr);
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
      // Validate the specific batch is active and has capacity
      const { data: batch } = await supabaseAdmin
        .from("ticket_batches")
        .select("*")
        .eq("id", batch_id)
        .eq("status", "active")
        .single();

      if (!batch) {
        return new Response(
          JSON.stringify({ error: "Este lote não está mais disponível. Atualize a página." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (batch.available_quantity < quantity) {
        return new Response(
          JSON.stringify({ error: `A quantidade solicitada excede os ingressos restantes neste lote. Disponível: ${batch.available_quantity}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      batchPrice = Number(batch.price);
    } else {
      // Find active batch for this event
      const { data: activeBatch } = await supabaseAdmin
        .from("ticket_batches")
        .select("*")
        .eq("event_id", event_id)
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!activeBatch || activeBatch.available_quantity < quantity) {
        return new Response(
          JSON.stringify({ error: activeBatch 
            ? `A quantidade solicitada excede os ingressos restantes neste lote. Disponível: ${activeBatch.available_quantity}`
            : "Não há ingressos disponíveis para este evento." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      batchPrice = Number(activeBatch.price);
      selectedBatchId = activeBatch.id;
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
        holder_cpf: buyer_cpf || null,
        check_in_status: "valid",
        user_id: guestUserId || null,
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

    // Atomically consume tickets from batch (handles switching)
    if (selectedBatchId) {
      const { data: consumeResult, error: consumeError } = await supabaseAdmin
        .rpc("consume_batch_tickets", { p_batch_id: selectedBatchId, p_quantity: quantity });

      if (consumeError || consumeResult?.error) {
        // Rollback: delete tickets and order
        await supabaseAdmin.from("tickets").delete().eq("order_id", order.id);
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        return new Response(
          JSON.stringify({ error: consumeResult?.error || "Erro ao reservar ingressos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── E-mail via Resend ──
    let emailSent = false;
    let emailError: string | null = null;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const ticketUrl = "https://easyticket-rouge.vercel.app/tickets";
    const loginUrl = "https://easyticket-rouge.vercel.app/auth";

    let guestAccountBlock = "";
    if (isNewUser) {
      // New user → show temp password
      guestAccountBlock = `
        <div style="margin-top: 20px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 20px; text-align: center;">
          <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px;">🔐 Sua conta foi criada automaticamente</p>
          <p style="color: #78716c; font-size: 13px; line-height: 1.5; margin: 0 0 12px;">
            Use a senha provisória abaixo para acessar seus ingressos. Recomendamos alterá-la após o primeiro acesso.
          </p>
          <div style="background: #ffffff; border: 2px dashed #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <span style="font-family: monospace; font-size: 20px; font-weight: 700; color: #1e293b; letter-spacing: 2px;">${tempPassword}</span>
          </div>
          <a href="${loginUrl}" style="display: inline-block; background: #1e293b; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Acessar minha conta →
          </a>
        </div>`;
    } else if (guestUserId) {
      // Existing user → inform they already have an account
      guestAccountBlock = `
        <div style="margin-top: 20px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 20px; text-align: center;">
          <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 8px;">✅ Você já possui uma conta no EasyTicket</p>
          <p style="color: #78716c; font-size: 13px; line-height: 1.5; margin: 0 0 12px;">
            Acesse usando sua senha cadastrada para ver seus ingressos.
          </p>
          <a href="${loginUrl}" style="display: inline-block; background: #1e293b; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Acessar minha conta →
          </a>
        </div>`;
    }

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
          ${guestAccountBlock}
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
        </div>
      </div>
    `;

    console.log("📧 [RESEND DEBUG] Key exists:", resendApiKey ? "SIM" : "NÃO");
    if (resendApiKey) {
      try {
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
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    } else {
      console.log("📧 [MOCK EMAIL] Would send to:", buyer_email);
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
