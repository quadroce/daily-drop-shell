import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import EmailVerification from "./EmailVerification";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

const ProtectedRoute = ({ children, requireEmailVerification = true }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    if (loading || profileLoading) return;

    // No session - redirect to auth
    if (!session || !user) {
      navigate("/auth");
      return;
    }

    // Check if email verification is required and user is not verified
    if (requireEmailVerification) {
      // Google OAuth users are considered verified by provider
      const isGoogleUser = user.app_metadata?.provider === 'google';
      const isLinkedInUser = user.app_metadata?.provider === 'linkedin';
      const isEmailVerified = user.email_confirmed_at !== null;
      
      if (!isGoogleUser && !isLinkedInUser && !isEmailVerified) {
        setShowVerification(true);
        return;
      }
    }

    // Check if onboarding is completed and user is on onboarding page - redirect to feed
    if (profile && profile.onboarding_completed && window.location.pathname === '/onboarding') {
      navigate("/feed", { replace: true });
      return;
    }

    // Check if onboarding is not completed - redirect to onboarding
    if (profile && !profile.onboarding_completed) {
      // Don't redirect if already on onboarding page
      if (window.location.pathname !== '/onboarding') {
        navigate("/onboarding");
        return;
      }
    }

    setShowVerification(false);
  }, [user, session, loading, profileLoading, profile, navigate, requireEmailVerification]);

  // Show loading while checking auth state
  if (loading || profileLoading) {
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