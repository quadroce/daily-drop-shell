import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SecretStatus {
  name: string;
  label: string;
  present: boolean;
}

export function YouTubeCredentialsStatus() {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSecrets();
  }, []);

  const checkSecrets = async () => {
    setLoading(true);
    
    const secretsToCheck = [
      { name: 'YOUTUBE_CLIENT_ID', label: 'YouTube Client ID' },
      { name: 'YOUTUBE_CLIENT_SECRET', label: 'YouTube Client Secret' },
      { name: 'YOUTUBE_REFRESH_TOKEN', label: 'YouTube Refresh Token' },
      { name: 'YOUTUBE_API_KEY', label: 'YouTube API Key' },
      { name: 'GCLOUD_TTS_PROJECT', label: 'Google Cloud TTS Project' },
      { name: 'GCLOUD_TTS_SA_JSON_BASE64', label: 'Google Cloud TTS Service Account' },
      { name: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
    ];

    try {
      // Call edge function to check secret presence (never expose values)
      const { data, error } = await supabase.functions.invoke('youtube-credentials-check');
      
      if (error) throw error;

      const statusResults: SecretStatus[] = secretsToCheck.map(secret => ({
        name: secret.name,
        label: secret.label,
        present: data?.secrets?.[secret.name] === true,
      }));

      setSecrets(statusResults);
    } catch (error) {
      console.error('Error checking secrets:', error);
      // Fallback: assume all not present
      setSecrets(secretsToCheck.map(s => ({ ...s, present: false })));
    } finally {
      setLoading(false);
    }
  };

  const allPresent = secrets.every(s => s.present);
  const presentCount = secrets.filter(s => s.present).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Credentials Status</CardTitle>
          </div>
          <Badge variant={allPresent ? "default" : "destructive"}>
            {presentCount}/{secrets.length} Present
          </Badge>
        </div>
        <CardDescription>
          Verify that all required API keys and secrets are configured (values never exposed)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Checking credentials...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {secrets.map((secret) => (
              <div
                key={secret.name}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <span className="text-sm font-medium">{secret.label}</span>
                {secret.present ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p>🔒 Secret values are never exposed to the frontend for security.</p>
          <p>✅ Green checkmark = secret is configured in Supabase.</p>
          <p>❌ Red X = secret is missing or not configured.</p>
        </div>
      </CardContent>
    </Card>
  );
}
