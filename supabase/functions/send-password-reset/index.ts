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
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "E-mail é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "https://www.easyticket.dev.br/update-password",
      },
    });

    if (linkError) {
      console.error("❌ Error generating recovery link:", linkError);
      // Return 200 anyway to avoid leaking whether email exists
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error("❌ No action_link in response:", JSON.stringify(linkData));
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔗 Password reset link generated for ${email}`);

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎫 EasyTicket</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">Recuperação de Senha</p>
        </div>

        <div style="padding: 32px 24px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 22px;">Redefinir sua senha</h2>
          <p style="color: #64748b; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
            Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color: #1e293b;">EasyTicket</strong>.
          </p>

          <p style="color: #64748b; margin: 0 0 8px; font-size: 15px; line-height: 1.6;">
            Clique no botão abaixo para criar uma nova senha:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${actionLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px;">
              Redefinir minha senha →
            </a>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 16px; margin-top: 20px;">
            <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
              ⚠️ <strong>Este link é válido por tempo limitado.</strong> Se expirar, solicite um novo link na tela de login.
            </p>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">
              Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança. Sua senha atual permanecerá inalterada.
            </p>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">EasyTicket — Ingressos simplificados</p>
        </div>
      </div>
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        subject: "Recuperação de Senha - EasyTicket",
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`❌ Resend error [${resendRes.status}]:`, errBody);
    } else {
      const resendData = await resendRes.json();
      console.log(`✅ Password reset email sent to ${email}, Resend ID: ${resendData.id}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ send-password-reset error:", err);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
