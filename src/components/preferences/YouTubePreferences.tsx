import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Youtube } from "lucide-react";

interface YouTubePreferencesProps {
  youtubeEmbedPref: boolean;
  onYouTubeChange: (enabled: boolean) => void;
}

export const YouTubePreferences: React.FC<YouTubePreferencesProps> = ({
  youtubeEmbedPref,
  onYouTubeChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-600" />
          YouTube Video Preferences
        </CardTitle>
        <p className="text-muted-foreground">
          Configure how YouTube videos are displayed in your feed.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3">
            <Youtube className="h-5 w-5 mt-0.5 text-red-600" />
            <div>
              <h4 className="font-medium">YouTube Video Embeds</h4>
              <p className="text-sm text-muted-foreground">
                Show YouTube videos inline in your feed (Premium feature)
              </p>
            </div>
          </div>
          <Switch
            checked={youtubeEmbedPref}
            onCheckedChange={onYouTubeChange}
          />
        </div>
      </CardContent>
    </Card>
  );
};