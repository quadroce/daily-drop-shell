import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import EmailVerification from "./EmailVerification";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

const ProtectedRoute = ({ children, requireEmailVerification = true }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const { profile, isLoading: profileLoading, refetch } = useUserProfile();
  const navigate = useNavigate();
  const [showVerification, setShowVerification] = useState(false);

  // Set up realtime listener for profile changes
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 ProtectedRoute: Setting up realtime listener for profile changes');
    
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 ProtectedRoute: Profile changed, refetching...', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 ProtectedRoute: Cleaning up realtime listener');
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  useEffect(() => {
    console.log('🛡️ ProtectedRoute: Evaluating conditions', {
      loading,
      profileLoading,
      hasSession: !!session,
      hasUser: !!user,
      hasProfile: !!profile,
      onboardingCompleted: profile?.onboarding_completed,
      currentPath: window.location.pathname
    });

    if (loading || profileLoading) {
      console.log('⏳ ProtectedRoute: Still loading, waiting...');
      return;
    }

    // No session - redirect to auth
    if (!session || !user) {
      console.log('🚫 ProtectedRoute: No session/user, redirecting to auth');
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
        console.log('📧 ProtectedRoute: Email verification required, showing verification screen');
        setShowVerification(true);
        return;
      }
    }

    // Check if onboarding is completed and user is on onboarding page - redirect to feed
    if (profile && profile.onboarding_completed && window.location.pathname === '/onboarding') {
      console.log('🎯 ProtectedRoute: Onboarding completed, redirecting from /onboarding to /feed');
      navigate("/feed", { replace: true });
      return;
    }

    // Check if onboarding is not completed - redirect to onboarding
    if (profile && !profile.onboarding_completed) {
      // Don't redirect if already on onboarding page
      if (window.location.pathname !== '/onboarding') {
        console.log('📝 ProtectedRoute: Onboarding not completed, redirecting to /onboarding');
        navigate("/onboarding");
        return;
      }
    }

    console.log('✅ ProtectedRoute: All conditions passed, rendering protected content');
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