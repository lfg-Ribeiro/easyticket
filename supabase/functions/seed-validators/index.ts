import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid authentication" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: adminRole } = await admin
      .from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (user.email !== "lribeiro@easyticket.com" && !adminRole) return json({ error: "Não autorizado" }, 403);

    // Load existing users once
    const existing = new Map<string, string>();
    for (let page = 1; page < 50; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      data.users.forEach((u) => u.email && existing.set(u.email.toLowerCase(), u.id));
      if (data.users.length < 1000) break;
    }

    const results: { email: string; status: string }[] = [];
    for (let i = 1; i <= 10; i++) {
      const email = `validador${i}@easyticket.com`;
      const password = `validador${i}`;
      let id = existing.get(email);
      let status = "existente";
      if (!id) {
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: `Validador ${i}` },
        });
        if (error || !data.user) { results.push({ email, status: `erro: ${error?.message}` }); continue; }
        id = data.user.id;
        status = "criado";
      }
      await admin.from("user_roles").upsert({ user_id: id, role: "validator" }, { onConflict: "user_id,role" });
      results.push({ email, status });
    }
    return json({ success: true, results });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
