import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type SubscriptionTier = Database['public']['Enums']['subscription_tier'];

interface UseUserProfileReturn {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  isPremium: boolean;
  subscriptionTier: SubscriptionTier | null;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching user profile:', fetchError);
        setError(fetchError.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setError('Failed to fetch profile');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const isPremium = profile?.subscription_tier === 'premium' || 
                   profile?.subscription_tier === 'corporate' || 
                   profile?.subscription_tier === 'sponsor';

  return {
    profile,
    isLoading,
    error,
    isPremium,
    subscriptionTier: profile?.subscription_tier || null,
    refetch: fetchProfile,
  };
}