import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Film, Gauge, Loader2, Wrench, Calendar, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function YouTubeUtilities() {
  const [isCheckingQuota, setIsCheckingQuota] = useState(false);
  const [isTestingUpload, setIsTestingUpload] = useState(false);
  const [isCreatingTestJob, setIsCreatingTestJob] = useState(false);
  const [isTestingScheduler, setIsTestingScheduler] = useState(false);
  const [isTestingWorker, setIsTestingWorker] = useState(false);
  const [isTestingShortsProcessor, setIsTestingShortsProcessor] = useState(false);
  const [isReschedulingShorts, setIsReschedulingShorts] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const validateQuota = async () => {
    setIsCheckingQuota(true);
    setQuotaStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "youtube-quota-check",
      );

      if (error) throw error;

      setQuotaStatus(data);

      if (data.quotaAvailable) {
        toast.success("Quota available for uploads");
      } else {
        toast.error(`Quota exceeded: ${data.error || "quota_exceeded"}`);
      }
    } catch (error: any) {
      console.error("Quota check error:", error);
      toast.error(
        `Quota Check Error: ${error.message || "quota_check_failed"}`,
      );
      setQuotaStatus({ quotaAvailable: false, error: error.message });
    } finally {
      setIsCheckingQuota(false);
    }
  };

  const testUploadDryRun = async () => {
    setIsTestingUpload(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "youtube-shorts-dry-run",
      );

      if (error) throw error;

      setTestResult(data);
      toast.success(`Test completed: ${data.duration}s video generated`);
    } catch (error: any) {
      console.error("Test upload error:", error);
      toast.error(
        `Test Upload Error: ${error.message || "test_upload_failed"}`,
      );
      setTestResult({ success: false, error: error.message });
    } finally {
      setIsTestingUpload(false);
    }
  };

  const createTestJob = async () => {
    setIsCreatingTestJob(true);
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
          locale: "en",
          status: "queued",
          utm_campaign: "test",
          utm_content: "manual_admin_test",
        });

      if (error) throw error;

      toast.success("Test comment job created and queued for processing");
    } catch (error: any) {
      console.error("Create test job error:", error);
      toast.error(`Failed to create test job: ${error.message}`);
    } finally {
      setIsCreatingTestJob(false);
    }
  };

  const testScheduler = async () => {
    setIsTestingScheduler(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "comments-scheduler",
        { body: { trigger: "manual_test" } }
      );

      if (error) throw error;

      toast.success(
        `Scheduler test completed: ${data.scheduled || 0} jobs scheduled`
      );
      console.log("Scheduler result:", data);
    } catch (error: any) {
      console.error("Scheduler test error:", error);
      toast.error(`Scheduler test failed: ${error.message}`);
    } finally {
      setIsTestingScheduler(false);
    }
  };

  const testWorker = async () => {
    setIsTestingWorker(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "youtube-auto-comment",
        { body: { trigger: "manual_test" } }
      );

      if (error) throw error;

      toast.success("Worker test completed - check logs for details");
      console.log("Worker result:", data);
    } catch (error: any) {
      console.error("Worker test error:", error);
      toast.error(`Worker test failed: ${error.message}`);
    } finally {
      setIsTestingWorker(false);
    }
  };

  const testShortsProcessor = async () => {
    setIsTestingShortsProcessor(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "youtube-shorts-processor",
        { body: { trigger: "manual_test" } }
      );

      if (error) throw error;

      toast.success(`Shorts processor completed: ${data?.processed || 0} shorts processed`);
      console.log("Shorts processor result:", data);
    } catch (error: any) {
      console.error("Shorts processor error:", error);
      toast.error(`Shorts processor failed: ${error.message}`);
    } finally {
      setIsTestingShortsProcessor(false);
    }
  };

  const rescheduleQueuedShorts = async () => {
    setIsReschedulingShorts(true);
    try {
      // Update all queued shorts to be scheduled for now
      const { data: jobs, error: fetchError } = await supabase
        .from("short_jobs")
        .select("id")
        .eq("status", "queued");

      if (fetchError) throw fetchError;

      if (!jobs || jobs.length === 0) {
        toast.info("No queued shorts to reschedule");
        return;
      }

      const { error: updateError } = await supabase
        .from("short_jobs")
        .update({ scheduled_for: new Date().toISOString() })
        .eq("status", "queued");

      if (updateError) throw updateError;

      toast.success(`${jobs.length} shorts rescheduled for immediate processing`);
      
      // Trigger processor
      await testShortsProcessor();
    } catch (error: any) {
      console.error("Reschedule error:", error);
      toast.error(`Failed to reschedule: ${error.message}`);
    } finally {
      setIsReschedulingShorts(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          <CardTitle>Utilities & Diagnostics</CardTitle>
        </div>
        <CardDescription>
          Test quota availability and upload functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={validateQuota}
              disabled={isCheckingQuota}
              className="gap-2"
            >
              {isCheckingQuota
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Gauge className="h-4 w-4" />}
              Validate Upload Quota
            </Button>

            <Button
              onClick={testUploadDryRun}
              disabled={isTestingUpload}
              variant="outline"
              className="gap-2"
            >
              {isTestingUpload
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Film className="h-4 w-4" />}
              Test Upload (Dry-Run)
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              onClick={createTestJob}
              disabled={isCreatingTestJob}
              variant="secondary"
              className="gap-2"
            >
              {isCreatingTestJob
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <AlertCircle className="h-4 w-4" />}
              Create Test Comment Job
            </Button>

            <Button
              onClick={testScheduler}
              disabled={isTestingScheduler}
              variant="secondary"
              className="gap-2"
            >
              {isTestingScheduler
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Calendar className="h-4 w-4" />}
              Test Scheduler Now
            </Button>

            <Button
              onClick={testWorker}
              disabled={isTestingWorker}
              variant="secondary"
              className="gap-2"
            >
              {isTestingWorker
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Play className="h-4 w-4" />}
              Test Worker Now
            </Button>

            <Button
              onClick={testShortsProcessor}
              disabled={isTestingShortsProcessor}
              variant="secondary"
              className="gap-2"
            >
              {isTestingShortsProcessor
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Film className="h-4 w-4" />}
              Test Shorts Processor
            </Button>

            <Button
              onClick={rescheduleQueuedShorts}
              disabled={isReschedulingShorts}
              variant="outline"
              className="gap-2"
            >
              {isReschedulingShorts
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Calendar className="h-4 w-4" />}
              Reschedule Shorts NOW
            </Button>
          </div>
        </div>

        {/* Quota Status Display */}
        {quotaStatus && (
          <Alert
            variant={quotaStatus.quotaAvailable ? "default" : "destructive"}
          >
            <Gauge className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <strong>Quota Status:</strong>
                  <Badge
                    variant={quotaStatus.quotaAvailable
                      ? "default"
                      : "destructive"}
                  >
                    {quotaStatus.quotaAvailable ? "Available" : "Exceeded"}
                  </Badge>
                </div>

                {quotaStatus.estimatedUsage !== undefined && (
                  <p className="text-sm">
                    Estimated Usage: {quotaStatus.estimatedUsage} units
                  </p>
                )}

                {quotaStatus.remainingUploads !== undefined && (
                  <p className="text-sm">
                    Remaining Uploads (est.): {quotaStatus.remainingUploads}
                  </p>
                )}

                {quotaStatus.remainingComments !== undefined && (
                  <p className="text-sm">
                    Remaining Comments (est.): {quotaStatus.remainingComments}
                  </p>
                )}

                {quotaStatus.error && (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Error: {quotaStatus.error}
                    </p>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Test Result Display */}
        {testResult && (
          <Alert
            variant={testResult.success !== false ? "default" : "destructive"}
          >
            <Film className="h-4 w-4" />
            <AlertDescription>
              {testResult.success !== false
                ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <strong>Test Upload (Dry-Run):</strong>
                      <Badge>Success</Badge>
                    </div>

                    {testResult.duration && (
                      <p className="text-sm">
                        Video Duration: {testResult.duration}s
                      </p>
                    )}

                    {testResult.fileSize && (
                      <p className="text-sm">
                        File Size: {testResult.fileSize}
                      </p>
                    )}

                    {testResult.metadata && (
                      <div className="text-xs text-muted-foreground mt-2">
                        <p>
                          Metadata:{" "}
                          {JSON.stringify(testResult.metadata, null, 2)}
                        </p>
                      </div>
                    )}
                  </div>
                )
                : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Test Failed</strong>
                      <p className="text-sm mt-1">{testResult.error}</p>
                    </div>
                  </div>
                )}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
          <p>
            📊 <strong>Validate Quota:</strong>{" "}
            Checks current YouTube API quota usage
          </p>
          <p>
            🎬 <strong>Test Upload:</strong>{" "}
            Runs a 3s FFmpeg mock render without publishing
          </p>
          <p>
            💬 <strong>Create Test Job:</strong>{" "}
            Creates a queued comment job (Linus Tech Tips video)
          </p>
          <p>
            📅 <strong>Test Scheduler:</strong>{" "}
            Runs the daily scheduler to assign scheduled_for times
          </p>
          <p>
            ▶️ <strong>Test Worker:</strong>{" "}
            Runs the comment worker to process due jobs
          </p>
          <p>
            🎬 <strong>Test Shorts Processor:</strong>{" "}
            Processes queued YouTube Shorts and publishes them
          </p>
          <p>
            📅 <strong>Reschedule Shorts NOW:</strong>{" "}
            Re-schedules all queued shorts for immediate processing and triggers processor
          </p>
          <p>
            ⚠️ Quota limits: 10,000 units/day (1 upload = ~1600 units, 1 comment
            = ~50 units)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
