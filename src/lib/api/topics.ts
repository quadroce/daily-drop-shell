import { supabase } from "@/integrations/supabase/client";
import { FeedCardProps } from "@/components/FeedCard";

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

// Mock data functions for the new topic system
export const getTopicData = async (slug: string): Promise<Topic> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const topics: Record<string, Topic> = {
    'ai-ml': {
      slug: 'ai-ml',
      title: 'AI & Machine Learning',
      introHtml: `<p>Stay ahead of the curve with the latest developments in artificial intelligence and machine learning. From breakthrough research papers to practical applications, we curate the most important AI news that matters to your business and career. Our daily drops include expert analysis, tool reviews, and insights from leading researchers and practitioners in the field.</p>`
    },
    'technology': {
      slug: 'technology',
      title: 'Technology',
      introHtml: `<p>Discover the latest in technology innovation, from cutting-edge startups to major industry shifts. We track emerging trends, product launches, and technological breakthroughs that are shaping the future. Get comprehensive coverage of software, hardware, and digital transformation across all industries.</p>`
    }
  };

  const topic = topics[slug];
  if (!topic) {
    throw new Error(`Topic ${slug} not found`);
  }

  return topic;
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
  await new Promise(resolve => setTimeout(resolve, 400));

  // Generate mock dates (last 120 days)
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 120; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Filter for premium users (unlimited) vs free users (90 days)
  const availableDates = isPremium ? dates : dates.slice(0, 90);

  const days = availableDates.slice(0, 20).map(date => ({
    date,
    items: [
      {
        id: `${date}-1`,
        title: `AI Breakthrough on ${date}`,
        href: `https://example.com/${date}-1`,
        source: { name: 'TechNews', url: 'https://technews.com' }
      },
      {
        id: `${date}-2`,
        title: `Machine Learning Update ${date}`,
        href: `https://example.com/${date}-2`,
        source: { name: 'AI Weekly', url: 'https://aiweekly.com' }
      },
      {
        id: `${date}-3`,
        title: `Industry Analysis for ${date}`,
        href: `https://example.com/${date}-3`,
        source: { name: 'Forbes', url: 'https://forbes.com' }
      }
    ]
  }));

  return { availableDates, days };
};

export const getTopicDaily = async (slug: string, date: string): Promise<FeedCardProps[]> => {
  await new Promise(resolve => setTimeout(resolve, 350));

  // Generate 5-10 items for the daily drop with constraints
  const mockItems: FeedCardProps[] = [
    {
      id: `${date}-daily-1`,
      type: 'video',
      title: `Daily AI Insights for ${date}`,
      summary: 'Comprehensive overview of the day\'s most important AI developments and their implications for the industry.',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      publishedAt: `${date}T09:00:00Z`,
      source: { name: 'AI Today', url: 'https://aitoday.com' },
      tags: ['Daily', 'AI', 'Insights'],
      href: `https://aitoday.com/${date}`,
      youtubeId: 'dQw4w9WgXcQ',
      isPremium: true
    },
    {
      id: `${date}-daily-2`,
      type: 'article',
      title: `Breaking: New Startup Raises $100M for AI Infrastructure`,
      summary: 'Emerging AI infrastructure company secures major funding round to build next-generation training platforms.',
      imageUrl: 'https://via.placeholder.com/400x200/8b5cf6/ffffff?text=Startup+News',
      publishedAt: `${date}T07:30:00Z`,
      source: { name: 'VentureBeat', url: 'https://venturebeat.com' },
      tags: ['Startup', 'Funding', 'Infrastructure'],
      href: `https://venturebeat.com/${date}-funding`
    },
    {
      id: `${date}-daily-3`,
      type: 'article',
      title: 'Research Paper: Improved Transformer Architecture Shows 40% Efficiency Gains',
      summary: 'New academic research demonstrates significant improvements in transformer model efficiency while maintaining performance.',
      imageUrl: 'https://via.placeholder.com/400x200/f59e0b/ffffff?text=Research',
      publishedAt: `${date}T06:00:00Z`,
      source: { name: 'arXiv', url: 'https://arxiv.org' },
      tags: ['Research', 'Transformers', 'Efficiency'],
      href: `https://arxiv.org/${date}-transformer`
    },
    {
      id: `${date}-daily-4`,
      type: 'article',
      title: 'Industry Report: AI Adoption Reaches 85% Among Fortune 500 Companies',
      summary: 'Comprehensive survey reveals widespread AI adoption across major corporations, with significant ROI reported.',
      imageUrl: 'https://via.placeholder.com/400x200/ef4444/ffffff?text=Industry+Report',
      publishedAt: `${date}T05:00:00Z`,
      source: { name: 'McKinsey', url: 'https://mckinsey.com' },
      tags: ['Industry', 'Adoption', 'Fortune 500'],
      href: `https://mckinsey.com/${date}-ai-adoption`
    },
    {
      id: `${date}-daily-5`,
      type: 'article',
      title: 'Tool Spotlight: New Open-Source Framework Simplifies ML Deployment',
      summary: 'Community-driven project launches to make machine learning model deployment more accessible to developers.',
      imageUrl: 'https://via.placeholder.com/400x200/06b6d4/ffffff?text=Open+Source',
      publishedAt: `${date}T04:00:00Z`,
      source: { name: 'GitHub Blog', url: 'https://github.blog' },
      tags: ['Tools', 'Open Source', 'Deployment'],
      href: `https://github.blog/${date}-ml-framework`
    }
  ];

  return mockItems;
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
