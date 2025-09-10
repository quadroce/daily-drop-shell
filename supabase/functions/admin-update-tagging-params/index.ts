import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://YOUR-PROJECT.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jres(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function supa(path: string, init: RequestInit = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res;
}

type Params = {
  max_topics_per_drop?: number;
  max_l3_per_drop?: number;
  similarity_threshold?: number;
  allow_cross_domain?: boolean;
  llm_confidence_threshold?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body: Params = await req.json().catch(() => ({}));
    const updates = Object.entries(body).map(([param_name, param_value]) => ({
      param_name,
      param_value: String(param_value),
      updated_at: new Date().toISOString(),
    }));

    if (!updates.length) return jres(400, { error: "No params provided" });

    await supa(`/rest/v1/tagging_params`, {
      method: "UPSERT",
      body: JSON.stringify(updates),
    }).catch(async () => {
      // fallback to upsert per-row
      for (const row of updates) {
        await supa(`/rest/v1/tagging_params`, { method: "POST", body: JSON.stringify(row) });
      }
    });

    // Optional: log admin action via RPC if available
    // await supa(`/rest/v1/rpc/log_admin_action`, { method: "POST", body: JSON.stringify({ ... }) });

    return jres(200, { success: true, updated: updates.map(u => u.param_name) });
  } catch (e) {
    return jres(500, { error: "Internal error", details: String(e) });
  }
});
