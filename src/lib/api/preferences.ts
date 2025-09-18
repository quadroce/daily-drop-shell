import { supabase } from "@/integrations/supabase/client";

export interface UserPreferences {
  selectedTopicIds: number[];
  selectedLanguageIds: number[];
}

export const saveAllUserPreferences = async (preferences: {
  languages: string[];
  topicIds: number[];
}): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    // Get language IDs from language codes
    const { data: languages, error: langError } = await supabase
      .from('languages')
      .select('id, code')
      .in('code', preferences.languages);

    if (langError) {
      console.error('Error fetching languages:', langError);
      throw new Error(`Failed to fetch languages: ${langError.message}`);
    }

    const languageIds = languages?.map(lang => lang.id) || [];

    // Update profiles table (for backward compatibility)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        language_prefs: preferences.languages
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating profile languages:', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    // Update preferences table (main source of truth)
    const { error: prefsError } = await supabase
      .from('preferences')
      .upsert({
        user_id: user.id,
        selected_language_ids: languageIds,
        selected_topic_ids: preferences.topicIds,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (prefsError) {
      console.error('Error updating preferences:', prefsError);
      throw new Error(`Failed to update preferences: ${prefsError.message}`);
    }

    // Clear user_topic_preferences (legacy table) and repopulate
    await supabase
      .from('user_topic_preferences')
      .delete()
      .eq('user_id', user.id);

    // Insert new topic preferences
    if (preferences.topicIds.length > 0) {
      const topicPrefs = preferences.topicIds.map((topicId, index) => ({
        user_id: user.id,
        topic_id: topicId,
        level: 1, // Default level
        priority: index + 1
      }));

      const { error: topicError } = await supabase
        .from('user_topic_preferences')
        .insert(topicPrefs);

      if (topicError) {
        console.error('Error inserting topic preferences:', topicError);
        // Don't throw - main preferences were saved
      }
    }

    console.log('Successfully saved all user preferences');

  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
};

export const fetchAllUserPreferences = async (): Promise<{
  selectedTopicIds: number[];
  selectedLanguageIds: number[];
  languageCodes: string[];
} | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    // Get from preferences table first (primary source)
    const { data: preferences, error: prefsError } = await supabase
      .from('preferences')
      .select('selected_topic_ids, selected_language_ids')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
      throw new Error(`Failed to fetch preferences: ${prefsError.message}`);
    }

    // Get language codes from IDs
    let languageCodes: string[] = [];
    if (preferences?.selected_language_ids?.length > 0) {
      const { data: languages } = await supabase
        .from('languages')
        .select('code')
        .in('id', preferences.selected_language_ids);
      
      languageCodes = languages?.map(lang => lang.code) || [];
    }

    // If we have preferences data, return it
    if (preferences && (preferences.selected_topic_ids?.length > 0 || preferences.selected_language_ids?.length > 0)) {
      return {
        selectedTopicIds: preferences.selected_topic_ids || [],
        selectedLanguageIds: preferences.selected_language_ids || [],
        languageCodes
      };
    }

    // Fallback to profile data if no preferences found
    const { data: profile } = await supabase
      .from('profiles')
      .select('language_prefs')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.language_prefs?.length > 0) {
      // Get language IDs for consistency
      const { data: languages } = await supabase
        .from('languages')
        .select('id, code')
        .in('code', profile.language_prefs);
      
      const selectedLanguageIds = languages?.map(lang => lang.id) || [];

      return {
        selectedTopicIds: [],
        selectedLanguageIds,
        languageCodes: profile.language_prefs
      };
    }

    // No preferences found anywhere
    return {
      selectedTopicIds: [],
      selectedLanguageIds: [],
      languageCodes: ['en'] // Default to English
    };

  } catch (error) {
    console.error('Error fetching all preferences:', error);
    throw error;
  }
};