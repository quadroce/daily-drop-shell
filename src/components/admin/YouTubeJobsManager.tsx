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
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

export function YouTubeJobsManager() {
  const [isLoading, setIsLoading] = useState(false);
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

  const createCommentJobs = async () => {
    // Deprecated: use triggerJobCreator instead
    await triggerJobCreator();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube Jobs Manager</CardTitle>
        <CardDescription>
          Manage YouTube comment jobs queue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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

        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded space-y-1">
          <p>
            <strong>Scan for New Videos:</strong>{" "}
            Scans tagged YouTube videos and creates up to 20 comment jobs
          </p>
          <p>
            <strong>Clean Failed Jobs:</strong> Marks all error jobs as 'failed'
          </p>
          <p>
            <strong>Create Test Job:</strong> Adds Rick Astley video to queue
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
