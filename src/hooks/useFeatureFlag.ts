import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type FeatureFlagKey = 'show_alpha_ribbon' | 'show_feedback_button';

interface FeatureFlagValue {
  enabled: boolean;
}

export const useFeatureFlag = (key: FeatureFlagKey): boolean => {
  const [enabled, setEnabled] = useState<boolean>(true); // Default to true

  useEffect(() => {
    const fetchFeatureFlag = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .single();

        if (error || !data) {
          // If error or no data, use default (true)
          setEnabled(true);
          return;
        }

        const flagValue = data.value as unknown as FeatureFlagValue;
        setEnabled(flagValue?.enabled ?? true);
      } catch (error) {
        console.error(`Error fetching feature flag ${key}:`, error);
        setEnabled(true); // Fallback to default
      }
    };

    fetchFeatureFlag();
  }, [key]);

  return enabled;
};