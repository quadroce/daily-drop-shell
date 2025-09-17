import { supabase } from '@/integrations/supabase/client';

export async function initializeVectorSystem() {
  try {
    console.log('Initializing vector system...');
    
    const { data, error } = await supabase.functions.invoke('test-embedding-init', {
      body: {}
    });
    
    if (error) {
      console.error('Vector initialization error:', error);
      throw error;
    }
    
    console.log('Vector system initialization result:', data);
    return data;
  } catch (error) {
    console.error('Failed to initialize vector system:', error);
    throw error;
  }
}

export async function refreshUserProfile(userId?: string) {
  try {
    console.log('Refreshing user profile vector...');
    
    const { data, error } = await supabase.functions.invoke('refresh-user-profile', {
      body: userId ? { user_id: userId } : {}
    });
    
    if (error) {
      console.error('User profile refresh error:', error);
      throw error;
    }
    
    console.log('User profile refresh result:', data);
    return data;
  } catch (error) {
    console.error('Failed to refresh user profile:', error);
    throw error;
  }
}