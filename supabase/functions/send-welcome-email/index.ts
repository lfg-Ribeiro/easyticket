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
    const { email, name } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate a recovery link so the user can set their own password
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "https://easyticket-rouge.vercel.app/update-password",
      },
    });

    if (linkError) {
      console.error("❌ Error generating recovery link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate access link", details: linkError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error("❌ No action_link in response:", JSON.stringify(linkData));
      return new Response(
        JSON.stringify({ error: "No action link generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔗 Recovery link generated for ${email}`);

    // Build the welcome email HTML
    const displayName = name || "cliente";
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎫 EasyTicket</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">Bem-vindo(a) à plataforma!</p>
        </div>

        <div style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 22px;">Olá, ${displayName}! 👋</h2>
          <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Sua conta no <strong style="color: #1e293b;">EasyTicket</strong> foi criada com sucesso durante sua compra de ingresso.
          </p>

          <p style="color: #64748b; margin: 0 0 8px; font-size: 15px; line-height: 1.6;">
            Para acessar sua conta, ver seus ingressos e definir sua senha definitiva, clique no botão abaixo:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${actionLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px;">
              Acessar minha conta e definir senha →
            </a>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 16px; margin-top: 20px;">
            <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
              ⚠️ <strong>Este link é válido por tempo limitado.</strong> Se expirar, você poderá solicitar um novo link na tela de login usando "Esqueci minha senha".
            </p>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">
              Se você não solicitou esta conta, pode ignorar este e-mail com segurança.
            </p>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
        </div>
      </div>
    `;

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyTicket <contato@easyticket.dev.br>",
        to: [email],
        subject: "🎫 Bem-vindo ao EasyTicket — Defina sua senha",
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`❌ Resend error [${resendRes.status}]:`, errBody);
      return new Response(
        JSON.stringify({ success: false, email_sent: false, error: errBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendRes.json();
    console.log(`✅ Welcome email sent to ${email}, Resend ID: ${resendData.id}`);

    return new Response(
      JSON.stringify({ success: true, email_sent: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ send-welcome-email error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
