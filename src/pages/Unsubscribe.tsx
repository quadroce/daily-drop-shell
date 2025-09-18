import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Seo } from '@/components/Seo';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isResubscribe, setIsResubscribe] = useState(false);

  const token = searchParams.get('token');
  const action = searchParams.get('action') || 'unsubscribe';

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No unsubscribe token provided.');
      return;
    }

    // The actual unsubscribe processing happens in the edge function
    // This page is just for display after redirect
    const urlParams = new URLSearchParams(window.location.search);
    const processedAction = urlParams.get('processed');
    
    if (processedAction) {
      setIsResubscribe(processedAction === 'resubscribe');
      setStatus('success');
      setMessage(
        processedAction === 'resubscribe' 
          ? "You've successfully resubscribed to our newsletter!"
          : "You've been unsubscribed from our newsletter."
      );
    } else {
      // Redirect to the edge function to process the unsubscribe
      window.location.href = `https://qimelntuxquptqqynxzv.supabase.co/functions/v1/unsubscribe-newsletter?token=${token}&action=${action}`;
    }
  }, [token, action]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleManagePreferences = () => {
    navigate('/settings');
  };

  return (
    <>
      <Seo 
        title={action === 'resubscribe' ? 'Resubscribe - DailyDrops' : 'Unsubscribe - DailyDrops'}
        description="Manage your newsletter subscription preferences"
      />
      
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
              {status === 'loading' && (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              )}
              {status === 'success' && (
                <CheckCircle className={`w-8 h-8 ${isResubscribe ? 'text-green-500' : 'text-yellow-500'}`} />
              )}
              {status === 'error' && (
                <AlertCircle className="w-8 h-8 text-destructive" />
              )}
            </div>
            <CardTitle>
              {status === 'loading' && 'Processing...'}
              {status === 'success' && (isResubscribe ? 'Welcome back!' : 'Unsubscribed')}
              {status === 'error' && 'Error'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {status === 'loading' && 'Please wait while we process your request...'}
              {status === 'success' && message}
              {status === 'error' && message}
            </p>

            {status !== 'loading' && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={handleGoHome}
                  variant="outline"
                >
                  Go to Home
                </Button>
                <Button 
                  onClick={handleManagePreferences}
                >
                  Manage Preferences
                </Button>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                <strong>DailyDrops</strong><br />
                Curated content for curious minds
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}