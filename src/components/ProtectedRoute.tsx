import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import EmailVerification from "./EmailVerification";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

const ProtectedRoute = ({ children, requireEmailVerification = true }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    if (loading) return;

    // No session - redirect to auth
    if (!session || !user) {
      navigate("/auth");
      return;
    }

    // Check if email verification is required and user is not verified
    if (requireEmailVerification) {
      // Google OAuth users are considered verified by provider
      const isGoogleUser = user.app_metadata?.provider === 'google';
      const isEmailVerified = user.email_confirmed_at !== null;
      
      if (!isGoogleUser && !isEmailVerified) {
        setShowVerification(true);
        return;
      }
    }

    setShowVerification(false);
  }, [user, session, loading, navigate, requireEmailVerification]);

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show verification screen if email not verified
  if (showVerification) {
    return <EmailVerification onVerified={() => setShowVerification(false)} />;
  }

  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute;