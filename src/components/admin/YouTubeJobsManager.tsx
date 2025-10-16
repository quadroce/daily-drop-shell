import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCw, Trash2, PlayCircle, Zap } from "lucide-react";

export function YouTubeJobsManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isTestingEndToEnd, setIsTestingEndToEnd] = useState(false);
  const { toast } = useToast();

  const cleanupFailedJobs = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("social_comment_jobs")
        .update({ status: "failed" })
        .eq("status", "error")
        .gt("tries", 0);

      if (error) throw error;

      toast({
        title: "✅ Jobs Cleaned",
        description: "Failed jobs have been marked as 'failed'",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerJobCreator = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "youtube-job-creator",
        {
          body: { trigger: "manual_admin" },
        },
      );

      if (error) throw error;

      toast({
        title: "✅ Job Creator Executed",
        description: `Scanned YouTube videos and created ${
          data?.jobsCreated || 0
        } new comment jobs`,
      });
    } catch (error: any) {
      toast({
        title: "Error executing job creator",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestJob = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("social_comment_jobs")
        .insert({
          platform: "youtube",
          video_id: "YVHXYqMPyzc",
          channel_id: "UCXuqSBlHAE6Xw-yeJA0Tunw",
          video_title:
            "Piracy Is Dangerous And Harmful - WAN Show October 10, 2025",
          video_description:
            "The WAN Show - Linus Tech Tips discuss piracy, Microsoft changes, YouTube policies, and more in this October 10, 2025 livestream. Sponsors include Vessi, Proton Mail, Squarespace, Ubiquiti, Dell, Secretlab, and PIA VPN. Originally streamed live on YouTube.",
          topic_slug: "content-marketing",
          text_hash: `test-${Date.now()}`,
          utm_campaign: "youtube_oauth_test",
          utm_content: "test_comment",
          status: "queued",
        });

      if (error) throw error;

      toast({
        title: "✅ Test Job Created",
        description: "Created a new test job with Rick Astley video",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerReprocessing = async () => {
    setIsReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-youtube-reprocess');
      
      if (error) throw error;
      
      toast({
        title: "🔄 Reprocessing Started",
        description: `Processing batch of 50 videos. ${data?.result?.successful || 0} successful.`,
      });
    } catch (error: any) {
      toast({
        title: "Reprocessing Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const testEndToEnd = async () => {
    setIsTestingEndToEnd(true);
    try {
      // Step 1: Create jobs
      toast({ title: "Step 1/3: Creating jobs..." });
      const { data: createData, error: createError } = await supabase.functions.invoke('youtube-job-creator');
      if (createError) throw createError;
      
      const jobsCreated = createData?.jobsCreated || 0;
      toast({ title: `✓ Created ${jobsCreated} jobs` });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 2: Schedule jobs
      toast({ title: "Step 2/3: Scheduling jobs..." });
      const { data: schedData, error: schedError } = await supabase.functions.invoke('comments-scheduler');
      if (schedError) throw schedError;
      
      const scheduled = schedData?.scheduled || 0;
      toast({ title: `✓ Scheduled ${scheduled} jobs` });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Process scheduled jobs
      toast({ title: "Step 3/3: Processing scheduled jobs..." });
      const { data: procData, error: procError } = await supabase.functions.invoke('youtube-auto-comment');
      if (procError) throw procError;
      
      toast({
        title: "✅ End-to-End Test Complete!",
        description: `Created ${jobsCreated}, Scheduled ${scheduled}, Processed jobs ready`,
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingEndToEnd(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube Jobs Manager</CardTitle>
        <CardDescription>
          Manage YouTube comment jobs queue and system testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Operations */}
        <div className="space-y-3">
          <Button
            onClick={triggerJobCreator}
            disabled={isLoading}
            className="w-full gap-2"
          >
            {isLoading
              ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              )
              : (
                <>
                  <Plus className="h-4 w-4" />
                  Scan for New Videos
                </>
              )}
          </Button>

          <Button
            onClick={cleanupFailedJobs}
            disabled={isLoading}
            variant="outline"
            className="w-full gap-2"
          >
            {isLoading
              ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cleaning...
                </>
              )
              : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Clean Failed Jobs
                </>
              )}
          </Button>

          <Button
            onClick={createTestJob}
            disabled={isLoading}
            variant="outline"
            className="w-full gap-2"
          >
            {isLoading
              ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              )
              : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Create Test Job
                </>
              )}
          </Button>
        </div>

        {/* System Maintenance */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-semibold">🔄 System Maintenance</h4>
          <p className="text-sm text-muted-foreground">
            Reprocess YouTube videos to fix missing metadata (50 per batch)
          </p>
          <Button 
            onClick={triggerReprocessing}
            disabled={isReprocessing}
            variant="secondary"
            className="w-full gap-2"
          >
            {isReprocessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Batch...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Reprocess YouTube Videos
              </>
            )}
          </Button>
        </div>

        {/* End-to-End Test */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-semibold">🧪 End-to-End Test</h4>
          <p className="text-sm text-muted-foreground">
            Test complete workflow: Create → Schedule → Process
          </p>
          <Button 
            onClick={testEndToEnd}
            disabled={isTestingEndToEnd}
            variant="default"
            className="w-full gap-2"
          >
            {isTestingEndToEnd ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Run Full System Test
              </>
            )}
          </Button>
        </div>

        {/* Help Info */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded space-y-1 mt-4">
          <p>
            <strong>Scan for New Videos:</strong>{" "}
            Scans tagged YouTube videos and creates up to 20 comment jobs
          </p>
          <p>
            <strong>Clean Failed Jobs:</strong> Marks all error jobs as 'failed'
          </p>
          <p>
            <strong>Create Test Job:</strong> Adds test video to queue
          </p>
          <p>
            <strong>Reprocess:</strong> Fixes videos with missing YouTube metadata
          </p>
          <p>
            <strong>Full Test:</strong> Validates entire comment automation pipeline
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
