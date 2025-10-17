import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Admin function to cleanup duplicate YouTube comments
 * Finds jobs that posted multiple comments and marks them appropriately
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("🔍 Finding jobs with duplicate posts...");

    // Find jobs with multiple POSTED events
    const { data: duplicateJobs, error: queryError } = await supabase
      .from("social_comment_events")
      .select("job_id, data")
      .eq("phase", "POSTED")
      .eq("status", "success");

    if (queryError) {
      throw queryError;
    }

    // Group by job_id and count
    const jobCounts = new Map<number, { count: number; commentIds: string[] }>();
    
    for (const event of duplicateJobs || []) {
      const jobId = event.job_id;
      const commentId = event.data?.commentId;
      
      if (!jobCounts.has(jobId)) {
        jobCounts.set(jobId, { count: 0, commentIds: [] });
      }
      
      const entry = jobCounts.get(jobId)!;
      entry.count++;
      if (commentId) {
        entry.commentIds.push(commentId);
      }
    }

    // Filter to only jobs with multiple posts
    const duplicates = Array.from(jobCounts.entries())
      .filter(([_, data]) => data.count > 1)
      .sort((a, b) => b[1].count - a[1].count);

    console.log(`📊 Found ${duplicates.length} jobs with duplicate posts`);

    const results = {
      totalDuplicates: duplicates.length,
      updated: 0,
      failed: 0,
      details: [] as any[],
    };

    // Update each duplicate job
    for (const [jobId, data] of duplicates) {
      console.log(`📝 Updating job ${jobId} (${data.count} posts)`);

      const { data: job, error: jobError } = await supabase
        .from("social_comment_jobs")
        .select("video_id, video_title, status, external_comment_id")
        .eq("id", jobId)
        .single();

      if (jobError || !job) {
        console.error(`❌ Failed to fetch job ${jobId}:`, jobError);
        results.failed++;
        continue;
      }

      // Keep the first comment ID as the "official" one
      const officialCommentId = data.commentIds[0];

      // Update job with warning flag
      const { error: updateError } = await supabase
        .from("social_comment_jobs")
        .update({
          status: "posted",
          external_comment_id: officialCommentId,
          last_error: `⚠️ DUPLICATE CLEANUP: Posted ${data.count} times. Comment IDs: ${data.commentIds.join(", ")}`,
        })
        .eq("id", jobId);

      if (updateError) {
        console.error(`❌ Failed to update job ${jobId}:`, updateError);
        results.failed++;
        continue;
      }

      results.updated++;
      results.details.push({
        jobId,
        videoId: job.video_id,
        videoTitle: job.video_title,
        postCount: data.count,
        commentIds: data.commentIds,
        status: "updated",
      });

      console.log(`✅ Updated job ${jobId}`);
    }

    console.log(`✅ Cleanup complete: ${results.updated} updated, ${results.failed} failed`);

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Cleanup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
