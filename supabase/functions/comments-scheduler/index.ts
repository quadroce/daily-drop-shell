import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "Europe/Rome";
const DAILY_CAP = 50;
const MIN_SPACING_MINUTES = 20; // Average minimum spacing between comments

/**
 * Daily scheduler that distributes up to 50 comments across 24 hours
 * Runs at 00:05 Europe/Rome
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🕒 Starting daily comment scheduler (${TIMEZONE})`);

    // Get current time in Europe/Rome
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 5, 0, 0); // 00:05 today
    
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    // Get unscheduled queued jobs for today
    const { data: unscheduledJobs, error: jobsError } = await supabase
      .from("social_comment_jobs")
      .select("id, video_id, video_title, topic_slug, created_at")
      .eq("status", "queued")
      .eq("platform", "youtube")
      .is("scheduled_for", null)
      .order("created_at", { ascending: true })
      .limit(DAILY_CAP);

    if (jobsError) {
      console.error("❌ Error fetching jobs:", jobsError);
      throw jobsError;
    }

    if (!unscheduledJobs || unscheduledJobs.length === 0) {
      console.log("✅ No unscheduled jobs found");
      return new Response(
        JSON.stringify({
          success: true,
          scheduled: 0,
          message: "No jobs to schedule",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Found ${unscheduledJobs.length} unscheduled jobs`);

    // Calculate time slots with random jitter
    const totalMinutesInDay = 24 * 60 - 60; // Leave last hour buffer
    const baseSpacing = Math.floor(totalMinutesInDay / Math.min(unscheduledJobs.length, DAILY_CAP));
    
    const scheduledJobs = unscheduledJobs.map((job, index) => {
      // Calculate base time for this slot
      const baseMinutes = Math.min(index * baseSpacing, totalMinutesInDay);
      
      // Add random jitter: ±12-18 minutes
      const jitterMinutes = 12 + Math.random() * 6; // 12-18 minutes
      const jitterDirection = Math.random() < 0.5 ? -1 : 1;
      const finalMinutes = Math.max(0, baseMinutes + (jitterDirection * jitterMinutes));
      
      // Create scheduled time
      const scheduledFor = new Date(startOfDay);
      scheduledFor.setMinutes(scheduledFor.getMinutes() + finalMinutes);
      
      // Ensure we don't schedule before now
      if (scheduledFor < now) {
        scheduledFor.setTime(now.getTime() + (15 + Math.random() * 10) * 60 * 1000); // 15-25 min from now
      }

      return {
        id: job.id,
        scheduled_for: scheduledFor.toISOString(),
      };
    });

    // Bulk update jobs with their scheduled times
    const updates = scheduledJobs.map((job) =>
      supabase
        .from("social_comment_jobs")
        .update({ scheduled_for: job.scheduled_for })
        .eq("id", job.id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      console.error("⚠️ Some updates failed:", errors);
    }

    const successCount = scheduledJobs.length - errors.length;
    console.log(`✅ Successfully scheduled ${successCount}/${scheduledJobs.length} jobs`);

    // Log to events table
    await supabase.from("social_comment_events").insert({
      phase: "SCHEDULE",
      status: "success",
      message: `Scheduled ${successCount} jobs for today`,
      data: {
        scheduled: successCount,
        failed: errors.length,
        timezone: TIMEZONE,
        day_start: startOfDay.toISOString(),
        day_end: endOfDay.toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: successCount,
        failed: errors.length,
        jobs: scheduledJobs.map((j) => ({
          id: j.id,
          scheduled_for: j.scheduled_for,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("💥 Scheduler error:", error);
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
