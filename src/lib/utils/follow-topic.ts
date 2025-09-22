import { supabase } from "@/integrations/supabase/client";

const SAVED_TOPICS_KEY = 'dailydrops_saved_topics';

/**
 * Transfer topics saved in localStorage to user preferences
 * This should be called after successful login/signup
 */
export const transferSavedTopicsToPreferences = async (userId: string): Promise<void> => {
  try {
    const savedTopicsStr = localStorage.getItem(SAVED_TOPICS_KEY);
    if (!savedTopicsStr) return;

    const savedTopics: number[] = JSON.parse(savedTopicsStr);
    if (savedTopics.length === 0) return;

    // Get existing preferences
    const { data: existingPrefs } = await supabase
      .from('preferences')
      .select('selected_topic_ids, selected_language_ids')
      .eq('user_id', userId)
      .maybeSingle();

    // Merge saved topics with existing ones
    const existingTopicIds = existingPrefs?.selected_topic_ids || [];
    const mergedTopicIds = [...new Set([...existingTopicIds, ...savedTopics])];

    // Update preferences
    await supabase
      .from('preferences')
      .upsert({
        user_id: userId,
        selected_topic_ids: mergedTopicIds,
        selected_language_ids: existingPrefs?.selected_language_ids || [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    // Clear localStorage after successful transfer
    localStorage.removeItem(SAVED_TOPICS_KEY);
    
    console.log(`Transferred ${savedTopics.length} saved topics to preferences`);
  } catch (error) {
    console.error('Error transferring saved topics:', error);
  }
};

/**
 * Get topics saved in localStorage for non-authenticated users
 */
export const getSavedTopicsFromStorage = (): number[] => {
  try {
    const savedTopicsStr = localStorage.getItem(SAVED_TOPICS_KEY);
    return savedTopicsStr ? JSON.parse(savedTopicsStr) : [];
  } catch (error) {
    console.error('Error reading saved topics from localStorage:', error);
    return [];
  }
};

/**
 * Save a topic to localStorage for non-authenticated users
 */
export const saveTopicToStorage = (topicId: number): void => {
  try {
    const savedTopics = getSavedTopicsFromStorage();
    if (!savedTopics.includes(topicId)) {
      savedTopics.push(topicId);
      localStorage.setItem(SAVED_TOPICS_KEY, JSON.stringify(savedTopics));
    }
  } catch (error) {
    console.error('Error saving topic to localStorage:', error);
  }
};

/**
 * Remove a topic from localStorage for non-authenticated users
 */
export const removeTopicFromStorage = (topicId: number): void => {
  try {
    const savedTopics = getSavedTopicsFromStorage();
    const updatedTopics = savedTopics.filter(id => id !== topicId);
    localStorage.setItem(SAVED_TOPICS_KEY, JSON.stringify(updatedTopics));
  } catch (error) {
    console.error('Error removing topic from localStorage:', error);
  }
};