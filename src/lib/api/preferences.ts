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
    // Ensure we have at least one language (default to 'en' if none provided)
    const languagesToSave = preferences.languages.length > 0 ? preferences.languages : ['en'];
    
    // Get language IDs from language codes
    const { data: languages, error: langError } = await supabase
      .from('languages')
      .select('id, code')
      .in('code', languagesToSave);

    if (langError) {
      console.error('Error fetching languages:', langError);
      throw new Error(`Failed to fetch languages: ${langError.message}`);
    }

    const languageIds = languages?.map(lang => lang.id) || [];
    
    console.log('Saving preferences:', {
      topicIds: preferences.topicIds,
      languageIds,
      languageCodes: languagesToSave
    });

    // Note: No longer updating profiles.language_prefs - using only preferences.selected_language_ids

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

    console.log('Fetched preferences:', preferences);

    // Get language codes from IDs
    let languageCodes: string[] = [];
    if (preferences?.selected_language_ids?.length > 0) {
      const { data: languages } = await supabase
        .from('languages')
        .select('code')
        .in('id', preferences.selected_language_ids);
      
      languageCodes = languages?.map(lang => lang.code) || [];
    }

    // If we have a preferences record (regardless of array contents), return it
    if (preferences) {
      // If no languages selected, provide defaults (English and Italian)
      const defaultLanguageCodes = ['en', 'it'];
      const defaultLanguageIds = [1, 2]; // English: 1, Italian: 2
      
      const finalLanguageCodes = languageCodes.length > 0 ? languageCodes : defaultLanguageCodes;
      const finalLanguageIds = preferences.selected_language_ids?.length > 0 ? preferences.selected_language_ids : defaultLanguageIds;
      
      console.log('Returning existing preferences:', {
        selectedTopicIds: preferences.selected_topic_ids || [],
        selectedLanguageIds: finalLanguageIds,
        languageCodes: finalLanguageCodes
      });
      
      return {
        selectedTopicIds: preferences.selected_topic_ids || [],
        selectedLanguageIds: finalLanguageIds,
        languageCodes: finalLanguageCodes
      };
    }

    // Note: No longer using profiles.language_prefs as fallback - preferences table is source of truth

    // No preferences found anywhere - provide defaults
    return {
      selectedTopicIds: [],
      selectedLanguageIds: [1, 2], // Default to English and Italian
      languageCodes: ['en', 'it'] // Default to English and Italian
    };

  } catch (error) {
    console.error('Error fetching all preferences:', error);
    throw error;
  }
};