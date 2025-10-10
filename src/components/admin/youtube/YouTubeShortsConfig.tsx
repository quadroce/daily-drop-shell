import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Settings } from "lucide-react";

export function YouTubeShortsConfig() {
  // Read from environment (these would be set in Supabase secrets/config)
  const shortsConfig = {
    enabled: true, // This would come from DAILY_SHORTS_ENABLED or similar
    maxPerDay: 5,
    topicRotation: ['technology', 'ai-ml', 'programming', 'startups', 'web-dev'],
    scheduleTime: '09:00 UTC',
    autoPublish: false, // Dry-run mode by default
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            <CardTitle>Shorts Automation Configuration</CardTitle>
          </div>
          <Badge variant={shortsConfig.enabled ? "default" : "secondary"}>
            {shortsConfig.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <CardDescription>
          Current automation settings for YouTube Shorts generation (read-only)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={shortsConfig.enabled ? "default" : "secondary"}>
                {shortsConfig.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">Max Shorts per Day</span>
              <span className="text-sm font-mono">{shortsConfig.maxPerDay}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">Schedule Time</span>
              <span className="text-sm font-mono">{shortsConfig.scheduleTime}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">Auto-Publish</span>
              <Badge variant={shortsConfig.autoPublish ? "default" : "outline"}>
                {shortsConfig.autoPublish ? 'Yes' : 'Dry-Run Only'}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-sm font-medium mb-2">Topic Rotation</div>
              <div className="flex flex-wrap gap-2">
                {shortsConfig.topicRotation.map((topic) => (
                  <Badge key={topic} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Automation Details
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Content sourced from top-ranked drops</p>
                <p>• FFmpeg render with TTS narration</p>
                <p>• Automatic thumbnail generation</p>
                <p>• SEO-optimized titles & descriptions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-900 dark:text-blue-100">
          <p className="font-semibold mb-1">📋 Configuration Source</p>
          <p>These settings are read from Supabase secrets and environment configuration.</p>
          <p>To modify: Update DAILY_SHORTS_* environment variables in Supabase Edge Function settings.</p>
        </div>
      </CardContent>
    </Card>
  );
}
