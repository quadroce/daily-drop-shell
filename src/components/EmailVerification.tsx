import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface EmailVerificationProps {
  onVerified?: () => void;
}

const EmailVerification = ({ onVerified }: EmailVerificationProps) => {
  const [isResending, setIsResending] = useState(false);
  const { user } = useAuth();

  const handleResendVerification = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "No email address found.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`
        }
      });

      if (error) {
        toast({
          title: "Failed to resend verification",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification email sent",
          description: "Please check your inbox and click the verification link.",
        });
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      toast({
        title: "Error",
        description: "Failed to resend verification email.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You've been signed out of your account.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check your inbox</CardTitle>
            <CardDescription>
              We've sent a verification link to <strong>{user?.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Click the link in the email to verify your account. You may need to check your spam folder.
            </p>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleResendVerification}
              disabled={isResending}
            >
              {isResending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Resend verification email
            </Button>
            
            <div className="text-center">
              <Button variant="ghost" onClick={handleSignOut} className="text-sm">
                Sign in with a different account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailVerification;