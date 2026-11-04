import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const ROLES = ["admin", "organizer", "validator"];
const ASSIGNABLE = [...ROLES, "user"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdm } = await admin.from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (user.email !== "lribeiro@easyticket.com" && !isAdm) return json({ error: "Não autorizado" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "list") {
      const users: any[] = [];
      for (let page = 1; page < 50; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        users.push(...data.users);
        if (data.users.length < 1000) break;
      }
      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const { data: links } = await admin.from("event_organizers").select("user_id, event_id");
      const { data: owned } = await admin.from("events").select("id, organizer_id").is("deleted_at", null);
      const { data: events } = await admin.from("events").select("id, title, event_date").is("deleted_at", null).order("event_date");
      return json({
        events: events || [],
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          roles: (roles || []).filter((r) => r.user_id === u.id).map((r) => r.role).filter((r) => ROLES.includes(r)),
          event_ids: [
            ...new Set([
              ...(links || []).filter((l) => l.user_id === u.id).map((l) => l.event_id),
              ...(owned || []).filter((e) => e.organizer_id === u.id).map((e) => e.id),
            ]),
          ],
        })),
      });
    }

    if (action === "create" || action === "update") {
      const { email, password, role, event_ids = [] } = body;
      if (!ASSIGNABLE.includes(role)) return json({ error: "Cargo inválido" }, 400);
      let userId = body.user_id as string | undefined;
      if (action === "create") {
        if (!email || !password || password.length < 6) return json({ error: "E-mail e senha (mín. 6) obrigatórios" }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error || !data.user) return json({ error: error?.message || "Falha ao criar" }, 400);
        userId = data.user.id;
      } else {
        if (!userId) return json({ error: "user_id obrigatório" }, 400);
        if (password) {
          if (password.length < 6) return json({ error: "Senha mín. 6" }, 400);
          const { error } = await admin.auth.admin.updateUserById(userId, { password });
          if (error) return json({ error: error.message }, 400);
        }
      }
      if (userId === user.id && role !== "admin") return json({ error: "Você não pode remover seu próprio cargo de admin" }, 400);
      // Staff roles are exclusive; every account keeps the base "user" (Cliente) role.
      await admin.from("user_roles").delete().eq("user_id", userId).in("role", ROLES);
      const { data: hasUser } = await admin.from("user_roles").select("id").eq("user_id", userId).eq("role", "user").maybeSingle();
      if (!hasUser) await admin.from("user_roles").insert({ user_id: userId, role: "user" });
      if (role !== "user") await admin.from("user_roles").insert({ user_id: userId, role });
      await admin.from("event_organizers").delete().eq("user_id", userId);
      if (role !== "user" && role !== "admin" && event_ids.length) {
        await admin.from("event_organizers").insert(event_ids.map((id: string) => ({ user_id: userId, event_id: id })));
      }
      return json({ success: true, user_id: userId });
    }

    if (action === "asaas_payments") {
      // Support lookup: list Asaas payments for the CPFs used by a buyer e-mail.
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json({ error: "email obrigatório" }, 400);
      const key = Deno.env.get("ASAAS_API_KEY");
      if (!key) return json({ error: "Asaas não configurado" }, 400);
      const base = Deno.env.get("ASAAS_PRODUCTION") === "true" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
      const { data: orders } = await admin.from("orders").select("id, buyer_cpf, total_amount, payment_status, transaction_id, created_at").ilike("buyer_email", email);
      const { data: prof } = await admin.from("profiles").select("cpf").ilike("email", email).maybeSingle();
      const cpfs = [...new Set([...(orders || []).map((o) => o.buyer_cpf), prof?.cpf].filter(Boolean).map((c) => String(c).replace(/\D/g, "")))];
      const payments: any[] = [];
      for (const cpf of cpfs) {
        const cr = await fetch(`${base}/customers?cpfCnpj=${cpf}`, { headers: { access_token: key } }).then((r) => r.json());
        for (const c of cr.data || []) {
          const pr = await fetch(`${base}/payments?customer=${c.id}&limit=100`, { headers: { access_token: key } }).then((r) => r.json());
          for (const p of pr.data || []) payments.push({ id: p.id, value: p.value, status: p.status, billingType: p.billingType, externalReference: p.externalReference, dateCreated: p.dateCreated, paymentDate: p.paymentDate || p.clientPaymentDate });
        }
      }
      return json({ orders: orders || [], payments });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro interno" }, 500);
  }
});
