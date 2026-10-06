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
      if (!ROLES.includes(role)) return json({ error: "Cargo inválido" }, 400);
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
      await admin.from("user_roles").delete().eq("user_id", userId).in("role", ROLES);
      await admin.from("user_roles").insert({ user_id: userId, role });
      await admin.from("event_organizers").delete().eq("user_id", userId);
      if (event_ids.length) {
        await admin.from("event_organizers").insert(event_ids.map((id: string) => ({ user_id: userId, event_id: id })));
      }
      return json({ success: true, user_id: userId });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro interno" }, 500);
  }
});
