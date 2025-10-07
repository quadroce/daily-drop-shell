import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";

export function YouTubeTokenPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    expires_at: string;
    updated_at: string;
  } | null>(null);

  const loadTokenInfo = async () => {
    const { data, error } = await supabase
      .from('youtube_oauth_cache')
      .select('expires_at, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('Error loading token info:', error);
      return;
    }

    setTokenInfo(data);
  };

  const refreshToken = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-refresh-token');

      if (error) throw error;

      if (data.success) {
        toast.success('Token refreshed successfully!');
        await loadTokenInfo();
      } else {
        toast.error(data.error || 'Failed to refresh token');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh token');
      console.error('Error refreshing token:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getTokenStatus = () => {
    if (!tokenInfo) return null;

    const expiresAt = new Date(tokenInfo.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60);

    return {
      isExpired,
      minutesUntilExpiry,
      expiresAt,
    };
  };

  const status = getTokenStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          YouTube OAuth Token Manager
        </CardTitle>
        <CardDescription>
          Manage YouTube API access token refresh
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={refreshToken}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Token Now
          </Button>
          <Button 
            onClick={loadTokenInfo}
            variant="outline"
          >
            Check Status
          </Button>
        </div>

        {status && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Token Status:</span>
              {status.isExpired ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Expired
                </Badge>
              ) : (
                <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Valid
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires at:</span>
              <span className="font-mono">{status.expiresAt.toLocaleString()}</span>
            </div>

            {!status.isExpired && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time remaining:</span>
                <span className="font-mono flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {status.minutesUntilExpiry} minutes
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last updated:</span>
              <span className="font-mono">
                {new Date(tokenInfo.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p>ℹ️ The token is automatically refreshed every 50 minutes by a cron job.</p>
          <p>✅ You can manually refresh it anytime using the button above.</p>
          <p>🔒 The refresh token is stored securely in Supabase secrets.</p>
        </div>
      </CardContent>
    </Card>
  );
}
