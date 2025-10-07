import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw } from "lucide-react";

export function YouTubeJobsManager() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const cleanupFailedJobs = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('social_comment_jobs')
        .update({ status: 'failed' })
        .eq('status', 'error')
        .gt('tries', 0);

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

  const createTestJob = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('social_comment_jobs')
        .insert({
          video_id: 'dQw4w9WgXcQ',
          channel_id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
          video_title: 'Rick Astley - Never Gonna Give You Up',
          video_description: 'Official video for Rick Astley - Never Gonna Give You Up',
          topic_slug: 'technology',
          text_hash: `test-${Date.now()}`,
          utm_campaign: 'youtube_oauth_test',
          utm_content: 'test_comment',
          status: 'queued'
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
          onClick={cleanupFailedJobs} 
          disabled={isLoading}
          variant="outline"
          className="w-full gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Cleaning...
            </>
          ) : (
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
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Create Test Job
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded space-y-1">
          <p><strong>Clean Failed Jobs:</strong> Marks all error jobs as 'failed'</p>
          <p><strong>Create Test Job:</strong> Adds Rick Astley video to queue</p>
        </div>
      </CardContent>
    </Card>
  );
}
