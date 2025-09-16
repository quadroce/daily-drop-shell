import { supabase } from "@/integrations/supabase/client";
import { FeedCardProps } from "@/components/FeedCard";
import { format, parseISO } from "date-fns";

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

export async function fetchUserPreferences(): Promise<{
  selectedTopicIds: number[];
  selectedLanguageIds: number[];
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data: preferences, error } = await supabase
    .from('preferences')
    .select('selected_topic_ids, selected_language_ids')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // If no preferences found, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch preferences: ${error.message}`);
  }

  return {
    selectedTopicIds: preferences?.selected_topic_ids || [],
    selectedLanguageIds: preferences?.selected_language_ids || []
  };
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

export type Topic = {
  slug: string;
  title: string;
  introHtml: string;
};

export type ArchiveIndex = {
  availableDates: string[];
  days: {
    date: string;
    items: Pick<FeedCardProps, "id"|"title"|"href"|"source">[];
  }[];
};

export const getTopicData = async (slug: string): Promise<Topic> => {
  try {
    const { data: topic } = await supabase
      .from('topics')
      .select('slug, label')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!topic) {
      return {
        slug,
        title: slug.charAt(0).toUpperCase() + slug.slice(1),
        introHtml: `<p>Content about ${slug}.</p>`
      };
    }

    return {
      slug: topic.slug,
      title: topic.label,
      introHtml: `<p>Content about ${topic.label}.</p>`
    };
  } catch (error) {
    console.error('Error fetching topic data:', error);
    return {
      slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      introHtml: `<p>Content about ${slug}.</p>`
    };
  }
};

export const getTopicPreview = async (slug: string): Promise<FeedCardProps[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mock preview data with constraints: 3-5 items, at least 1 video
  const mockItems: FeedCardProps[] = [
    {
      id: '1',
      type: 'video',
      title: 'OpenAI Announces GPT-5: Revolutionary Breakthrough in AI Reasoning',
      summary: 'OpenAI unveils GPT-5 with unprecedented reasoning capabilities, showing dramatic improvements in complex problem-solving and multi-step thinking.',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      publishedAt: '2025-09-11T08:00:00Z',
      source: { name: 'OpenAI', url: 'https://openai.com' },
      tags: ['AI', 'GPT-5', 'Reasoning'],
      href: 'https://openai.com/gpt-5',
      youtubeId: 'dQw4w9WgXcQ',
      isPremium: true
    },
    {
      id: '2',
      type: 'article',
      title: 'Meta\'s New AI Model Outperforms GPT-4 in Coding Tasks',
      summary: 'Meta releases Code Llama 3, showing significant improvements in code generation and debugging across multiple programming languages.',
      imageUrl: 'https://via.placeholder.com/400x200/3b82f6/ffffff?text=Meta+AI',
      publishedAt: '2025-09-11T06:30:00Z',
      source: { name: 'TechCrunch', url: 'https://techcrunch.com' },
      tags: ['Meta', 'Coding', 'Llama'],
      href: 'https://techcrunch.com/meta-code-llama-3'
    },
    {
      id: '3',
      type: 'article',
      title: 'Google DeepMind Solves Protein Folding for All Known Proteins',
      summary: 'DeepMind\'s AlphaFold 3 successfully predicts the structure of all 200 million known proteins, revolutionizing drug discovery and biology research.',
      imageUrl: 'https://via.placeholder.com/400x200/10b981/ffffff?text=DeepMind',
      publishedAt: '2025-09-10T14:15:00Z',
      source: { name: 'Nature', url: 'https://nature.com' },
      tags: ['DeepMind', 'Protein', 'Biology'],
      href: 'https://nature.com/alphafold-3'
    }
  ];

  // Validate constraints
  const videoCount = mockItems.filter(item => item.type === 'video').length;
  if (videoCount < 1) {
    // Add a video if none exist (constraint repair)
    mockItems[0] = { ...mockItems[0], type: 'video', youtubeId: 'dQw4w9WgXcQ' };
  }

  return mockItems;
};

export const getTopicArchive = async (slug: string, isPremium: boolean): Promise<ArchiveIndex> => {
  try {
    // Get topic and its descendants 
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!topic) {
      return { availableDates: [], days: [] };
    }

    // Get all descendant topic IDs
    const { data: descendants } = await supabase
      .rpc('topic_descendants', { root: topic.id });
    
    const topicIds = descendants?.map(d => d.id) || [topic.id];

    // Get articles from the last 90 days (or 7 days for non-premium)
    const daysBack = isPremium ? 90 : 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: articles } = await supabase
      .from('drops')
      .select(`
        id,
        title,
        url,
        published_at,
        created_at,
        sources (
          name
        ),
        content_topics!inner (
          topic_id
        )
      `)
      .in('content_topics.topic_id', topicIds)
      .gte('published_at', cutoffDate.toISOString())
      .eq('tag_done', true)
      .order('published_at', { ascending: false })
      .limit(300);

    if (!articles) {
      return { availableDates: [], days: [] };
    }

    // Group articles by date
    const dayGroups = new Map<string, Array<Pick<FeedCardProps, "id"|"title"|"href"|"source">>>();
    
    articles.forEach(article => {
      const date = format(parseISO(article.published_at || article.created_at), 'yyyy-MM-dd');
      
      if (!dayGroups.has(date)) {
        dayGroups.set(date, []);
      }
      
      dayGroups.get(date)!.push({
        id: article.id.toString(),
        title: article.title,
        href: article.url,
        source: { 
          name: article.sources?.name || 'Unknown Source',
          url: article.sources?.name ? `https://${article.sources.name.toLowerCase().replace(/\s+/g, '')}.com` : '#'
        }
      });
    });

    // Convert to array and sort by date (newest first)
    const days = Array.from(dayGroups.entries())
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      availableDates: days.map(d => d.date),
      days
    };
  } catch (error) {
    console.error('Error fetching topic archive:', error);
    return { availableDates: [], days: [] };
  }
};

export const getTopicDaily = async (slug: string, date: string): Promise<FeedCardProps[]> => {
  try {
    // Get topic and its descendants 
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!topic) {
      return [];
    }

    // Get all descendant topic IDs
    const { data: descendants } = await supabase
      .rpc('topic_descendants', { root: topic.id });
    
    const topicIds = descendants?.map(d => d.id) || [topic.id];

    // Get articles for the specific date
    const startDate = `${date}T00:00:00Z`;
    const endDate = `${date}T23:59:59Z`;

    const { data: articles } = await supabase
      .from('drops')
      .select(`
        id,
        title,
        url,
        image_url,
        summary,
        published_at,
        created_at,
        type,
        tags,
        sources (
          name
        ),
        content_topics!inner (
          topic_id
        )
      `)
      .in('content_topics.topic_id', topicIds)
      .gte('published_at', startDate)
      .lte('published_at', endDate)
      .eq('tag_done', true)
      .order('published_at', { ascending: false });

    if (!articles) {
      return [];
    }

    return articles.map(article => {
      const youtubeId = article.type === 'video' ? extractYouTubeId(article.url) : null;
      
      return {
        id: article.id.toString(),
        title: article.title,
        href: article.url,
        source: { 
          name: article.sources?.name || 'Unknown Source',
          url: article.sources?.name ? `https://${article.sources.name.toLowerCase().replace(/\s+/g, '')}.com` : '#'
        },
        imageUrl: article.image_url,
        summary: article.summary || '',
        tags: article.tags || [slug],
        publishedAt: article.published_at || article.created_at,
        type: article.type === 'video' ? 'video' : 'article',
        isBookmarked: false, // TODO: Check user bookmarks
        youtubeId
      };
    });
  } catch (error) {
    console.error('Error fetching topic daily articles:', error);
    return [];
  }

  function extractYouTubeId(url: string): string | null {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
};

// Utility functions for sitemap
export const getTopicsForSitemap = async (): Promise<{ slug: string }[]> => {
  return [
    { slug: 'ai-ml' },
    { slug: 'technology' }
  ];
};

export const getAvailableDatesForSitemap = async (slug: string): Promise<string[]> => {
  const dates: string[] = [];
  const today = new Date();
  // Only include last 30 days in sitemap to keep it manageable
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};
