import { supabase } from "@/integrations/supabase/client";

export interface TopicTreeItem {
  id: number;
  slug: string;
  label: string;
  level: 1 | 2 | 3;
  parent_id: number | null;
}

export async function fetchTopicsTree(): Promise<TopicTreeItem[]> {
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('id, slug, label, level, parent_id')
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('label', { ascending: true });

    if (error) {
      console.error('Error fetching topics:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('No topics found in database, using fallback data');
      throw new Error('No topics found');
    }

    return data.map(topic => ({
      id: topic.id,
      slug: topic.slug,
      label: topic.label,
      level: topic.level as 1 | 2 | 3,
      parent_id: topic.parent_id
    }));
  } catch (error) {
    console.warn('Using fallback seed data due to error:', error);
    
    // Fallback data in case of database issues
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
}

// Get all descendant topic IDs for a given topic
export async function getTopicDescendants(topicId: number, allTopics: TopicTreeItem[]): Promise<number[]> {
  const descendants = new Set<number>();
  
  const findDescendants = (parentId: number) => {
    const children = allTopics.filter(t => t.parent_id === parentId);
    children.forEach(child => {
      descendants.add(child.id);
      findDescendants(child.id); // Recursively find descendants
    });
  };
  
  findDescendants(topicId);
  return Array.from(descendants);
}

// Expand topic preferences to include all descendants for ranking
export async function expandTopicPreferences(selectedTopicIds: number[]): Promise<number[]> {
  try {
    // Fetch all topics to build the hierarchy
    const allTopics = await fetchTopicsTree();
    const expandedIds = new Set(selectedTopicIds);
    
    // For each selected topic, add all its descendants
    for (const topicId of selectedTopicIds) {
      const topic = allTopics.find(t => t.id === topicId);
      if (topic && topic.level < 3) {
        const descendants = await getTopicDescendants(topicId, allTopics);
        descendants.forEach(id => expandedIds.add(id));
      }
    }
    
    return Array.from(expandedIds);
  } catch (error) {
    console.error('Error expanding topic preferences:', error);
    return selectedTopicIds; // Return original if expansion fails
  }
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

  // Expand topic preferences to include descendants for better article matching
  const expandedTopicIds = await expandTopicPreferences(topicIds);

  const { error } = await supabase
    .rpc('upsert_preferences', {
      _topics: expandedTopicIds, // Save expanded topics including descendants
      _langs: currentLanguages
    });

  if (error) {
    throw new Error(`Failed to save preferences: ${error.message}`);
  }
}