import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Only allow organizers or admin master
      const isAdmin = user.email === "lribeiro@easyticket.com";
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "organizer")
        .maybeSingle();

      if (!isAdmin && !roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirmed/paid orders only — never count pending/failed/expired
    const CONFIRMED_STATUSES = ["confirmed", "paid", "approved"];

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, subtotal, total_amount, service_fee, platform_fee, quantity, payment_status")
      .in("payment_status", CONFIRMED_STATUSES);

    console.log("Confirmed orders fetched:", orders?.length, "Error:", ordersError);

    // Organizer revenue = strictly the subtotal (ticket value), NEVER the platform fee
    const total_revenue = (orders || []).reduce(
      (sum: number, o: any) => sum + Number(o.subtotal ?? (Number(o.total_amount) - Number(o.platform_fee ?? o.service_fee ?? 0))),
      0
    );
    const total_fees = (orders || []).reduce(
      (sum: number, o: any) => sum + Number(o.platform_fee ?? o.service_fee ?? 0),
      0
    );
    const total_tickets = (orders || []).reduce(
      (sum: number, o: any) => sum + Number(o.quantity),
      0
    );

    const confirmedOrderIds = (orders || []).map((o: any) => o.id);

    // Check-ins only from tickets tied to confirmed orders
    let total_checkins = 0;
    if (confirmedOrderIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from("tickets")
        .select("check_in_status, order_id")
        .in("order_id", confirmedOrderIds);

      console.log("Tickets fetched:", tickets?.length, "Error:", ticketsError);

      total_checkins = (tickets || []).filter(
        (t: any) => t.check_in_status === "used"
      ).length;
    }

    // Fetch events count
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("events")
      .select("id");

    console.log("Events fetched:", events?.length, "Error:", eventsError);

    const result = {
      total_revenue,                  // organizer revenue = subtotal only
      total_fees,                     // platform fees (hidden from organizer payout)
      net_receivable: total_revenue,  // organizer keeps 100% of subtotal
      total_tickets,
      total_checkins,
      total_events: events?.length || 0,
    };

    console.log("Dashboard metrics result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Dashboard metrics error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
