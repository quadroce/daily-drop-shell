import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, CheckCircle, AlertCircle, Loader2, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function YouTubeOAuthPanel() {
  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [isFetchingChannel, setIsFetchingChannel] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<any>(null);
  const [channelInfo, setChannelInfo] = useState<any>(null);

  const startOAuthFlow = async () => {
    setIsStartingOAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-oauth-start');
      
      if (error) throw error;

      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=800');
        toast.success('OAuth flow started. Complete authorization in the popup window.');
      } else {
        throw new Error('oauth_url_missing');
      }
    } catch (error: any) {
      console.error('OAuth start error:', error);
      toast.error(`OAuth Error: ${error.message || 'oauth_start_failed'}`);
    } finally {
      setIsStartingOAuth(false);
    }
  };

  const checkTokenAndScopes = async () => {
    setIsCheckingToken(true);
    setTokenStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-token-check');
      
      if (error) throw error;

      setTokenStatus(data);
      
      if (data.valid && !data.needsReauthorization) {
        toast.success('Token is valid with all required scopes');
      } else if (data.needsReauthorization) {
        toast.error('Token missing scopes - reauthorization needed');
      } else if (data.expired) {
        toast.error('Token expired');
      } else {
        toast.error('Token invalid');
      }
    } catch (error: any) {
      console.error('Token check error:', error);
      toast.error(`Token Check Error: ${error.message || 'token_check_failed'}`);
      setTokenStatus({ valid: false, error: error.message });
    } finally {
      setIsCheckingToken(false);
    }
  };

  const fetchChannelInfo = async () => {
    setIsFetchingChannel(true);
    setChannelInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-channel-info');
      
      if (error) throw error;

      setChannelInfo(data);
      toast.success(`Channel found: ${data.channel?.title || 'Unknown'}`);
    } catch (error: any) {
      console.error('Channel fetch error:', error);
      toast.error(`Channel Fetch Error: ${error.message || 'channel_fetch_failed'}`);
      setChannelInfo({ error: error.message });
    } finally {
      setIsFetchingChannel(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-600" />
          <CardTitle>OAuth & Channel Management</CardTitle>
        </div>
        <CardDescription>
          Authorize YouTube API access and verify channel connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={startOAuthFlow} 
            disabled={isStartingOAuth}
            className="gap-2"
          >
            {isStartingOAuth ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Start OAuth Flow
          </Button>
          
          <Button 
            onClick={checkTokenAndScopes} 
            disabled={isCheckingToken}
            variant="outline"
            className="gap-2"
          >
            {isCheckingToken ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Check Token & Scopes
          </Button>
          
          <Button 
            onClick={fetchChannelInfo} 
            disabled={isFetchingChannel}
            variant="outline"
            className="gap-2"
          >
            {isFetchingChannel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Youtube className="h-4 w-4" />
            )}
            Fetch Channel Info
          </Button>
        </div>

        {/* Token Status Display */}
        {tokenStatus && (
          <Alert variant={tokenStatus.valid && !tokenStatus.needsReauthorization ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <strong>Token Status:</strong>
                  <Badge variant={tokenStatus.valid ? "default" : "destructive"}>
                    {tokenStatus.valid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
                
                {tokenStatus.expired && (
                  <p className="text-sm">⚠️ Token expired at: {new Date(tokenStatus.expiresAt).toLocaleString()}</p>
                )}
                
                {tokenStatus.needsReauthorization && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">⚠️ Reauthorization Required</p>
                    {tokenStatus.missingScopes && tokenStatus.missingScopes.length > 0 && (
                      <div className="text-xs">
                        <p>Missing scopes:</p>
                        <ul className="list-disc list-inside pl-2">
                          {tokenStatus.missingScopes.map((scope: string) => (
                            <li key={scope}>{scope}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {tokenStatus.error && (
                  <p className="text-sm">Error: {tokenStatus.error}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Channel Info Display */}
        {channelInfo && (
          <Alert>
            <Youtube className="h-4 w-4" />
            <AlertDescription>
              {channelInfo.error ? (
                <p className="text-sm text-red-600">Error: {channelInfo.error}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <strong>Channel:</strong>
                    <span>{channelInfo.channel?.title || 'Unknown'}</span>
                  </div>
                  {channelInfo.channel?.customUrl && (
                    <p className="text-sm">URL: {channelInfo.channel.customUrl}</p>
                  )}
                  {channelInfo.channel?.subscriberCount && (
                    <p className="text-sm">Subscribers: {parseInt(channelInfo.channel.subscriberCount).toLocaleString()}</p>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
          <p>📝 <strong>Start OAuth Flow:</strong> Opens Google authorization in a new window</p>
          <p>🔍 <strong>Check Token:</strong> Verifies current token validity and required scopes</p>
          <p>📺 <strong>Fetch Channel:</strong> Retrieves your YouTube channel information</p>
        </div>
      </CardContent>
    </Card>
  );
}
