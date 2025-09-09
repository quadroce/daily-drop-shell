import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = { dropId: number; topicIds?: number[]; topicSlugs?: string[] };

function res(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return res(204, {});
  
  try {
    console.log('admin-update-tags: Starting request processing');
    
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!auth) {
      console.error('Missing Authorization header');
      return res(401, { error: "Missing Authorization" });
    }
    console.log('Authorization header found');

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error('Missing service environment variables');
      return res(500, { error: "Missing service envs" });
    }
    console.log('Environment variables loaded');

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${auth}` } },
    });
    console.log('Admin client created');

    // Verify user and role
    const { data: userRes, error: userError } = await admin.auth.getUser(auth);
    const user = userRes?.user;
    if (userError || !user) {
      console.error('Invalid session:', userError);
      return res(401, { error: "Invalid session" });
    }
    console.log('User authenticated:', user.id);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('Profile lookup failed:', profileError);
      return res(500, { error: "Profile lookup failed", details: profileError.message });
    }
    
    if (!profile || !["editor", "admin", "superadmin"].includes(profile.role)) {
      console.error('Insufficient permissions. User role:', profile?.role);
      return res(403, { error: "Forbidden - insufficient role" });
    }
    console.log('User role verified:', profile.role);

    // Parse input
    const body = (await req.json()) as Partial<Payload>;
    const dropId = Number(body?.dropId);
    let topicIds = Array.isArray(body?.topicIds) ? body!.topicIds!.map(Number) : [];

    if (!Number.isFinite(dropId)) {
      console.error('Invalid dropId:', body?.dropId);
      return res(400, { error: "dropId must be a number" });
    }
    console.log('Input parsed - dropId:', dropId, 'topicIds:', topicIds);

    // (Optional) Resolve topicSlugs -> id
    if (!topicIds.length && Array.isArray(body?.topicSlugs) && body!.topicSlugs!.length) {
      console.log('Resolving topic slugs to IDs:', body.topicSlugs);
      const { data: rows, error: tErr } = await admin
        .from("topics")
        .select("id, slug")
        .in("slug", body!.topicSlugs!);
      if (tErr) {
        console.error('Topic resolve failed:', tErr);
        return res(500, { error: "Topic resolve failed", details: tErr.message });
      }
      topicIds = (rows ?? []).map(r => Number(r.id));
      console.log('Resolved topic IDs:', topicIds);
    }

    // Verify drop exists
    const { data: drop, error: dropErr } = await admin
      .from("drops")
      .select("id")
      .eq("id", dropId)
      .maybeSingle();
    if (dropErr) {
      console.error('Drop lookup failed:', dropErr);
      return res(500, { error: "Drop lookup failed", details: dropErr.message });
    }
    if (!drop) {
      console.error('Drop not found:', dropId);
      return res(404, { error: "Drop not found" });
    }
    console.log('Drop verified:', drop.id);

    // Work with join table
    const JOIN_TABLE = "content_topics";
    const FK_COL = "content_id";

    // Get existing topic associations
    const { data: existing, error: exErr } = await admin
      .from(JOIN_TABLE)
      .select("topic_id")
      .eq(FK_COL, drop.id);
    if (exErr) {
      console.error('Read join failed:', exErr);
      return res(500, { error: "Read join failed", details: exErr.message });
    }
    console.log('Existing topics loaded:', existing);

    const current = new Set((existing ?? []).map((r: any) => Number(r.topic_id)));
    const next = new Set(topicIds);
    const toAdd = [...next].filter((x) => !current.has(x));
    const toDel = [...current].filter((x) => !next.has(x));
    
    console.log('Diff calculated - toAdd:', toAdd, 'toDel:', toDel);

    // Delete removed topics
    if (toDel.length) {
      console.log('Deleting topics:', toDel);
      const { error: delErr } = await admin
        .from(JOIN_TABLE)
        .delete()
        .eq(FK_COL, drop.id)
        .in("topic_id", toDel);
      if (delErr) {
        console.error('Delete failed:', delErr);
        return res(500, { error: "Delete failed", details: delErr.message });
      }
      console.log('Topics deleted successfully');
    }

    // Insert new topics
    if (toAdd.length) {
      console.log('Adding topics:', toAdd);
      const rows = toAdd.map((topic_id) => ({ [FK_COL]: drop.id, topic_id }));
      const { error: insErr } = await admin
        .from(JOIN_TABLE)
        .upsert(rows, { onConflict: `${FK_COL},topic_id`, ignoreDuplicates: true });
      if (insErr) {
        console.error('Insert failed:', insErr);
        return res(500, { error: "Insert failed", details: insErr.message });
      }
      console.log('Topics added successfully');
    }

    // Audit log (if table exists)
    try {
      await admin.from("admin_audit_log").insert({
        user_id: user.id,
        action: "update_tags",
        resource_type: "drop",
        resource_id: String(drop.id),
        details: { toAdd, toDel },
      });
      console.log('Audit log created');
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    console.log('Operation completed successfully');
    return res(200, { ok: true, changed: { add: toAdd.length, del: toDel.length } });
    
  } catch (e) {
    console.error('Unhandled error:', e);
    return res(500, { error: "Unhandled", details: String(e) });
  }
});