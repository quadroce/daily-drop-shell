import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://qimelntuxquptqqynxzv.supabase.co";
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action = "status" } = await req.json().catch(() => ({}));
    
    console.log(`🔍 Debug action: ${action}`);
    
    let result: any = {};

    switch (action) {
      case "fix_untagged_articles":
        console.log("🔧 Attempting to fix untagged articles...");
        
        // Get untagged articles with media tag
        const untaggedRes = await supa("/rest/v1/drops?tag_done=eq.false&tags=cs.{media}&select=id,title,tags&limit=5");
        const untaggedArticles = await untaggedRes.json();
        
        console.log(`Found ${untaggedArticles.length} untagged articles with media tag`);
        
        // Update them to set proper topic IDs
        for (const article of untaggedArticles) {
          console.log(`Processing article ${article.id}: ${article.title}`);
          
          // Set media as L1 topic (id=6 based on our query result)
          await supa(`/rest/v1/drops?id=eq.${article.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              l1_topic_id: 6, // media
              l2_topic_id: 34, // media-relations (a reasonable default)
              tag_done: true
            })
          });
          
          // Also update content_topics junction table
          await supa("/rest/v1/content_topics", {
            method: "POST",
            body: JSON.stringify([
              { content_id: article.id, topic_id: 6 },
              { content_id: article.id, topic_id: 34 }
            ])
          });
        }
        
        result.fixed_articles = untaggedArticles.length;
        break;

      case "clear_queue":
        console.log("🧹 Clearing stuck queue items...");
        
        // Reset stuck items to pending
        await supa("/rest/v1/ingestion_queue?status=eq.processing&created_at=lt.2025-09-13T00:00:00Z", {
          method: "PATCH",
          body: JSON.stringify({
            status: "pending",
            tries: 0,
            error: null
          })
        });
        
        result.queue_cleared = true;
        break;

      case "trigger_tagging":
        console.log("🏷️ Triggering tag-drops function...");
        
        try {
          const tagResponse = await fetch(`${SUPABASE_URL}/functions/v1/tag-drops`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              limit: 5,
              max_l3: 3
            })
          });
          
          const tagData = await tagResponse.json();
          result.tag_drops_response = {
            status: tagResponse.status,
            success: tagResponse.ok,
            data: tagData
          };
        } catch (error) {
          result.tag_drops_error = error.message;
        }
        break;

      case "restart_ingestion":
        console.log("🔄 Triggering restart-ingestion...");
        
        try {
          const restartResponse = await fetch(`${SUPABASE_URL}/functions/v1/restart-ingestion`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              trigger: "manual_debug"
            })
          });
          
          const restartData = await restartResponse.json();
          result.restart_response = {
            status: restartResponse.status,
            success: restartResponse.ok,
            data: restartData
          };
        } catch (error) {
          result.restart_error = error.message;
        }
        break;

      case "status":
      default:
        console.log("📊 Getting system status...");
        
        // Get ingestion health
        const healthRes = await supa("/rest/v1/rpc/get_ingestion_health");
        const health = await healthRes.json();
        
        // Get queue status
        const queueRes = await supa("/rest/v1/ingestion_queue?select=status,count()&group_by=status");
        const queueStats = await queueRes.json();
        
        // Get untagged count
        const untaggedRes = await supa("/rest/v1/drops?tag_done=eq.false&select=count()");
        const untaggedCount = await untaggedRes.json();
        
        // Get recent drops
        const recentRes = await supa("/rest/v1/drops?select=id,title,created_at,tag_done&order=created_at.desc&limit=10");
        const recentDrops = await recentRes.json();
        
        result = {
          health: health[0] || null,
          queue_stats: queueStats,
          untagged_count: untaggedCount[0]?.count || 0,
          recent_drops: recentDrops
        };
    }

    return jres(200, {
      success: true,
      action,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error("❌ Debug function error:", error);
    return jres(500, {
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});