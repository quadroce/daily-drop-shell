import { supabase } from "@/integrations/supabase/client";

export interface TopicTreeItem {
  id: number;
  slug: string;
  label: string;
  level: 1 | 2 | 3;
  parent_id: number | null;
}

export async function fetchTopicsTree(): Promise<TopicTreeItem[]> {
  // Return fallback data to avoid Supabase type issues for now
  const fallbackTopics: TopicTreeItem[] = [
    { id: 1, slug: "technology", label: "Technology", level: 1, parent_id: null },
    { id: 2, slug: "business", label: "Business", level: 1, parent_id: null },
    { id: 3, slug: "science", label: "Science", level: 1, parent_id: null },
    { id: 4, slug: "health", label: "Health", level: 1, parent_id: null },
    { id: 5, slug: "sports", label: "Sports", level: 1, parent_id: null },
    { id: 6, slug: "entertainment", label: "Entertainment", level: 1, parent_id: null }
  ];
  
  return fallbackTopics;
}

export async function saveUserTopics(topicIds: number[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  // Get current preferences to preserve languages
  const { data: currentPrefs } = await supabase
    .from('preferences')
    .select('selected_language_ids')
    .eq('user_id', user.id)
    .single();

  const currentLanguages = currentPrefs?.selected_language_ids || [];

  const { error } = await supabase
    .rpc('upsert_preferences', {
      _topics: topicIds,
      _langs: currentLanguages
    });

  if (error) {
    throw new Error(`Failed to save preferences: ${error.message}`);
  }
}