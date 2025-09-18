import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { updateSessionPersistence } from "@/lib/auth-persistence";

/**
 * Ensures user has a valid session before proceeding with authenticated actions
 * Throws an error if no session exists and shows user-friendly message
 */
export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    toast({
      title: "Please sign in to continue",
      description: "You need to be signed in to perform this action.",
      variant: "destructive",
    });
    
    // Navigate to auth page - this will be handled by the calling component
    throw new Error("NO_SESSION");
  }
  
  // Check email verification for non-OAuth users
  const user = session.user;
  if (user && !user.email_confirmed_at && user.app_metadata?.provider !== 'google') {
    toast({
      title: "Please verify your email",
      description: "You need to verify your email address to continue.",
      variant: "destructive",
    });
    
    throw new Error("EMAIL_NOT_VERIFIED");
  }
  
  return session;
}