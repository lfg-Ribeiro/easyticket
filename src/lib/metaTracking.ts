import { supabase } from "@/integrations/supabase/client";
import type { MetaTrackingValue } from "@/components/organizer/MetaTrackingFields";

/** Saves pixel id (public) on the event and the CAPI token in the admin-only secrets table. */
export async function saveMetaTracking(eventId: string, v: MetaTrackingValue) {
  const { error: e1 } = await supabase.from("events").update({ meta_pixel_id: v.pixelId || null }).eq("id", eventId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("event_meta_secrets")
    .upsert({ event_id: eventId, capi_token: v.capiToken || null, updated_at: new Date().toISOString() });
  if (e2) throw e2;
}

export async function loadMetaTracking(eventId: string): Promise<MetaTrackingValue> {
  const [{ data: ev }, { data: sec }] = await Promise.all([
    supabase.from("events").select("meta_pixel_id").eq("id", eventId).maybeSingle(),
    supabase.from("event_meta_secrets").select("capi_token").eq("event_id", eventId).maybeSingle(),
  ]);
  return { pixelId: ev?.meta_pixel_id ?? "", capiToken: sec?.capi_token ?? "" };
}
