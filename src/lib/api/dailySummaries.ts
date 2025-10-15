import { supabase } from "@/integrations/supabase/client";

export interface DailyTopicSummary {
  id: number;
  topic_slug: string;
  date: string;
  summary_en: string;
  article_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the daily summary for a specific topic and date
 */
export const getDailyTopicSummary = async (
  slug: string,
  date: string
): Promise<DailyTopicSummary | null> => {
  try {
    const { data, error } = await supabase
      .from('daily_topic_summaries')
      .select('*')
      .eq('topic_slug', slug)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error('Error fetching daily summary:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error fetching daily summary:', error);
    return null;
  }
};

/**
 * Generate a new daily summary (admin only)
 */
export const generateDailyTopicSummary = async (
  slug: string,
  date: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      'generate-daily-topic-summary',
      {
        body: { topic_slug: slug, date }
      }
    );

    if (error) {
      console.error('Error generating summary:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error generating summary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};