import { supabase } from "@/integrations/supabase/client";

export interface NewsletterSubscription {
  user_id: string;
  active: boolean;
  confirmed: boolean;
  cadence: string;
  slot: string;
}

/**
 * Get user's newsletter subscription status
 */
export async function getNewsletterSubscription(): Promise<NewsletterSubscription | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No subscription found - return null
      return null;
    }
    console.error('Error fetching newsletter subscription:', error);
    throw new Error(`Failed to fetch newsletter subscription: ${error.message}`);
  }

  return data;
}

/**
 * Update or create newsletter subscription
 */
export async function updateNewsletterSubscription(active: boolean): Promise<NewsletterSubscription> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .upsert({
      user_id: user.id,
      active,
      confirmed: true, // Auto-confirm for existing users
      cadence: 'daily',
      slot: 'morning'
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating newsletter subscription:', error);
    throw new Error(`Failed to update newsletter subscription: ${error.message}`);
  }

  return data;
}