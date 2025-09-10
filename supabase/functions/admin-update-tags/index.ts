// supabase/functions/admin-update-tags/index.ts
// CORS robusto + import dinamico di supabase-js (evita 500 su OPTIONS se l'import fallisce)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

type Json = Record<string, unknown>;

function corsHeaders(origin?: string, allowHeaders?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      allowHeaders || "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
function jres(status: number, payload: Json, origin?: string, allowHeaders?: string) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin, allowHeaders), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "*";
  const reqAllowHeaders = req.headers.get("Access-Control-Request-Headers") || undefined;

  // Preflight: **sempre** OK con CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin, reqAllowHeaders) });
  }
  if (req.method !== "POST") {
    return jres(405, { error: "Method not allowed" }, origin, reqAllowHeaders);
  }

  // Import **dinamico** di supabase-js: evita errori a livello modulo che romperebbero la OPTIONS
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jres(500, { error: "Missing service envs (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)" }, origin, reqAllowHeaders);
  }

  // Client admin
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // --- Auth & ruolo ---
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return jres(401, { error: "Missing Authorization Bearer token" }, origin, reqAllowHeaders);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return jres(401, { error: "Invalid or expired token" }, origin, reqAllowHeaders);

  const uid = userData.user.id as string;
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  if (profErr || !profile) return jres(403, { error: "User profile not found" }, origin, reqAllowHeaders);

  const allowed = ["admin", "editor", "superadmin"];
  if (!allowed.includes(profile.role)) {
    return jres(403, { error: "Forbidden: insufficient role" }, origin, reqAllowHeaders);
  }

  // --- Body & validazioni ---
  let body: any;
  try { body = await req.json(); } catch { return jres(400, { error: "Invalid JSON body" }, origin, reqAllowHeaders); }

  const contentId = Number(body?.contentId);
  const topicIds: number[] = Array.isArray(body?.topicIds) ? body.topicIds.map(Number) : [];
  if (!Number.isFinite(contentId) || contentId <= 0) {
    return jres(400, { error: "contentId must be a positive number" }, origin, reqAllowHeaders);
  }
  if (!topicIds.length) {
    return jres(400, { error: "topicIds must be a non-empty array of IDs" }, origin, reqAllowHeaders);
  }
  const uniqueTopicIds = Array.from(new Set(topicIds.filter((n) => Number.isFinite(n) && n > 0)));

  // Carica topics
  const { data: topics, error: topicsErr } = await admin
    .from("topics")
    .select("id, level, is_active")
    .in("id", uniqueTopicIds);
  if (topicsErr) return jres(500, { error: "Failed to fetch topics", details: topicsErr.message }, origin, reqAllowHeaders);

  // Esistenza / attivi
  const foundIds = new Set((topics ?? []).map((t: any) => t.id));
  const missing = uniqueTopicIds.filter((id) => !foundIds.has(id));
  if (missing.length) return jres(400, { error: "Some topic IDs do not exist", missing }, origin, reqAllowHeaders);

  const inactive = (topics ?? []).filter((t: any) => t.is_active === false).map((t: any) => t.id);
  if (inactive.length) return jres(400, { error: "Some topics are inactive", inactive }, origin, reqAllowHeaders);

  // Vincoli: esattamente 1×L1 e 1×L2
  const l1 = (topics ?? []).filter((t: any) => t.level === 1).length;
  const l2 = (topics ?? []).filter((t: any) => t.level === 2).length;
  if (l1 !== 1 || l2 !== 1) {
    return jres(400, { error: "Exactly 1 topic at level=1 and 1 at level=2 are required", counts: { level1: l1, level2: l2 } }, origin, reqAllowHeaders);
  }

  // --- Update transazionale via RPC ---
  const variants = [
    { fn: "set_article_topics", args: { content_id: contentId, topic_ids: uniqueTopicIds } },
    { fn: "set_article_topics", args: { p_content_id: contentId, p_topic_ids: uniqueTopicIds } },
    { fn: "set_article_topics", args: { _content_id: contentId, _topic_ids: uniqueTopicIds } },
  ] as const;

  let ok = false, rpcErr = "";
  for (const v of variants) {
    const { error } = await admin.rpc(v.fn, v.args as any);
    if (!error) { ok = true; break; }
    rpcErr = error.message || String(error);
  }
  if (!ok) {
    return jres(500, {
      error: "RPC set_article_topics failed or is missing",
      details: rpcErr,
      hint: "Create set_article_topics(bigint, bigint[]) to replace rows in content_topics atomically."
    }, origin, reqAllowHeaders);
  }

  // Audit best-effort
  await admin.from("admin_audit_log").insert({
    user_id: uid,
    action: "update_topics",
    resource_type: "drop",
    resource_id: String(contentId),
    details: { topic_ids: uniqueTopicIds } as unknown as Json,
  }).throwOnError().catch(() => { /* ignore */ });

  return jres(200, { ok: true, contentId, topicIds: uniqueTopicIds }, origin, reqAllowHeaders);
});
