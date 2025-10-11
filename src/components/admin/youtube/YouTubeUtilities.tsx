import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Wrench, Gauge, Film, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function YouTubeUtilities() {
  const [isCheckingQuota, setIsCheckingQuota] = useState(false);
  const [isTestingUpload, setIsTestingUpload] = useState(false);
  const [isCreatingTestJob, setIsCreatingTestJob] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const validateQuota = async () => {
    setIsCheckingQuota(true);
    setQuotaStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-quota-check');
      
      if (error) throw error;

      setQuotaStatus(data);
      
      if (data.quotaAvailable) {
        toast.success('Quota available for uploads');
      } else {
        toast.error(`Quota exceeded: ${data.error || 'quota_exceeded'}`);
      }
    } catch (error: any) {
      console.error('Quota check error:', error);
      toast.error(`Quota Check Error: ${error.message || 'quota_check_failed'}`);
      setQuotaStatus({ quotaAvailable: false, error: error.message });
    } finally {
      setIsCheckingQuota(false);
    }
  };

  const testUploadDryRun = async () => {
    setIsTestingUpload(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-shorts-dry-run');
      
      if (error) throw error;

      setTestResult(data);
      toast.success(`Test completed: ${data.duration}s video generated`);
    } catch (error: any) {
      console.error('Test upload error:', error);
      toast.error(`Test Upload Error: ${error.message || 'test_upload_failed'}`);
      setTestResult({ success: false, error: error.message });
    } finally {
      setIsTestingUpload(false);
    }
  };

  const createTestJob = async () => {
    setIsCreatingTestJob(true);
    try {
      const { error } = await supabase
        .from('social_comment_jobs')
        .insert({
          platform: 'youtube',
          video_id: 'dQw4w9WgXcQ',
          channel_id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
          video_title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
          video_description: 'The official video for "Never Gonna Give You Up" by Rick Astley',
          topic_slug: 'pop-music',
          text_hash: `test-${Date.now()}`,
          locale: 'en',
          status: 'queued',
          utm_campaign: 'test',
          utm_content: 'manual_admin_test'
        });

      if (error) throw error;

      toast.success('Test comment job created and queued for processing');
    } catch (error: any) {
      console.error('Create test job error:', error);
      toast.error(`Failed to create test job: ${error.message}`);
    } finally {
      setIsCreatingTestJob(false);
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
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={validateQuota} 
            disabled={isCheckingQuota}
            className="gap-2"
          >
            {isCheckingQuota ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gauge className="h-4 w-4" />
            )}
            Validate Upload Quota
          </Button>
          
          <Button 
            onClick={testUploadDryRun} 
            disabled={isTestingUpload}
            variant="outline"
            className="gap-2"
          >
            {isTestingUpload ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Film className="h-4 w-4" />
            )}
            Test Upload (Dry-Run)
          </Button>

          <Button 
            onClick={createTestJob} 
            disabled={isCreatingTestJob}
            variant="secondary"
            className="gap-2"
          >
            {isCreatingTestJob ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            Create Test Comment Job
          </Button>
        </div>

        {/* Quota Status Display */}
        {quotaStatus && (
          <Alert variant={quotaStatus.quotaAvailable ? "default" : "destructive"}>
            <Gauge className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <strong>Quota Status:</strong>
                  <Badge variant={quotaStatus.quotaAvailable ? "default" : "destructive"}>
                    {quotaStatus.quotaAvailable ? 'Available' : 'Exceeded'}
                  </Badge>
                </div>
                
                {quotaStatus.estimatedUsage !== undefined && (
                  <p className="text-sm">Estimated Usage: {quotaStatus.estimatedUsage} units</p>
                )}
                
                {quotaStatus.remainingUploads !== undefined && (
                  <p className="text-sm">Remaining Uploads (est.): {quotaStatus.remainingUploads}</p>
                )}
                
                {quotaStatus.remainingComments !== undefined && (
                  <p className="text-sm">Remaining Comments (est.): {quotaStatus.remainingComments}</p>
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
          <Alert variant={testResult.success !== false ? "default" : "destructive"}>
            <Film className="h-4 w-4" />
            <AlertDescription>
              {testResult.success !== false ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <strong>Test Upload (Dry-Run):</strong>
                    <Badge>Success</Badge>
                  </div>
                  
                  {testResult.duration && (
                    <p className="text-sm">Video Duration: {testResult.duration}s</p>
                  )}
                  
                  {testResult.fileSize && (
                    <p className="text-sm">File Size: {testResult.fileSize}</p>
                  )}
                  
                  {testResult.metadata && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <p>Metadata: {JSON.stringify(testResult.metadata, null, 2)}</p>
                    </div>
                  )}
                </div>
              ) : (
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
          <p>📊 <strong>Validate Quota:</strong> Checks current YouTube API quota usage</p>
          <p>🎬 <strong>Test Upload:</strong> Runs a 3s FFmpeg mock render without publishing</p>
          <p>💬 <strong>Test Comment:</strong> Creates a test comment job (Rick Astley video)</p>
          <p>⚠️ Quota limits: 10,000 units/day (1 upload = ~1600 units, 1 comment = ~50 units)</p>
        </div>
      </CardContent>
    </Card>
  );
}
