import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export interface OnboardingProfile {
  first_name?: string;
  last_name?: string;
  company_role?: string;
  language_prefs: string[];
  youtube_embed_pref: boolean;
}

export interface UserTopicPreference {
  user_id: string;
  topic_id: number;
  level: 1 | 2 | 3;
  priority?: number;
}

/**
 * Save profile information during onboarding
 */
export async function saveProfile(payload: OnboardingProfile): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Validate language preferences (max 3)
  if (payload.language_prefs.length > 3) {
    throw new Error("Maximum 3 languages allowed");
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: payload.first_name,
      last_name: payload.last_name,
      company_role: payload.company_role,
      language_prefs: payload.language_prefs,
      youtube_embed_pref: payload.youtube_embed_pref,
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error saving profile:', error);
    throw new Error(`Failed to save profile: ${error.message}`);
  }

  return data;
}

/**
 * Save user topic preferences (max 15 topics)
 */
export async function saveTopics(topicIds: number[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Validate max 15 topics
  if (topicIds.length > 15) {
    throw new Error("Maximum 15 topics allowed");
  }

  // Get topic levels for validation
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, level')
    .in('id', topicIds);

  if (topicsError) {
    throw new Error(`Failed to validate topics: ${topicsError.message}`);
  }

  // Delete existing preferences
  const { error: deleteError } = await supabase
    .from('user_topic_preferences')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) {
    throw new Error(`Failed to clear existing preferences: ${deleteError.message}`);
  }

  // Insert new preferences
  const preferences: Omit<UserTopicPreference, 'priority'>[] = topics.map((topic) => ({
    user_id: user.id,
    topic_id: topic.id,
    level: topic.level as 1 | 2 | 3,
  }));

  const { error: insertError } = await supabase
    .from('user_topic_preferences')
    .insert(preferences);

  if (insertError) {
    throw new Error(`Failed to save topic preferences: ${insertError.message}`);
  }
}

/**
 * Mark onboarding as completed
 */
export async function markOnboardingComplete(): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete onboarding: ${error.message}`);
  }

  return data;
}

/**
 * Get user's topic preferences
 */
export async function getUserTopicPreferences(): Promise<number[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('user_topic_preferences')
    .select('topic_id')
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to get topic preferences: ${error.message}`);
  }

  return data.map(pref => pref.topic_id);
}

/**
 * Get current user profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

/**
 * Update user preferences (languages and YouTube embed)
 */
export async function updateUserPreferences(preferences: {
  language_prefs: string[];
  youtube_embed_pref: boolean;
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Validate language preferences (max 3)
  if (preferences.language_prefs.length > 3) {
    throw new Error("Maximum 3 languages allowed");
  }

  if (preferences.language_prefs.length < 1) {
    throw new Error("At least 1 language is required");
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      language_prefs: preferences.language_prefs,
      youtube_embed_pref: preferences.youtube_embed_pref,
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating preferences:', error);
    throw new Error(`Failed to update preferences: ${error.message}`);
  }

  return data;
}

/**
 * Fetch available languages from database
 */
export async function fetchAvailableLanguages(): Promise<{ code: string; label: string }[]> {
  const { data, error } = await supabase
    .from("languages")
    .select("code, label")
    .order("label");
  
  if (error) {
    throw new Error(`Failed to fetch languages: ${error.message}`);
  }
  
  return data ?? [];
}