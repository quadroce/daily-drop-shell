import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("🔄 Manually triggering ingestion restart...");
    
    // Call restart-ingestion function
    const restartResponse = await fetch(`${SUPABASE_URL}/functions/v1/restart-ingestion`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trigger: "manual_admin_fix",
        force_rss: false,  // Skip RSS for now to focus on queue processing
        force_tag: true    // Force tagging to process remaining untagged articles
      })
    });
    
    const restartData = await restartResponse.json();
    console.log("Restart response:", restartData);

    // Also trigger tag-drops specifically for remaining untagged articles
    const tagResponse = await fetch(`${SUPABASE_URL}/functions/v1/tag-drops`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 43,  // Process all remaining untagged
        max_l3: 3,
        concurrent_requests: 3
      })
    });
    
    const tagData = await tagResponse.json();
    console.log("Tag drops response:", tagData);

    return new Response(JSON.stringify({
      success: true,
      message: "Manual restart and tagging triggered",
      restart_ingestion: {
        status: restartResponse.status,
        success: restartResponse.ok,
        data: restartData
      },
      tag_drops: {
        status: tagResponse.status, 
        success: tagResponse.ok,
        data: tagData
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Manual restart failed:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});