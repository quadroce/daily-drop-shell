import { supabase } from "@/integrations/supabase/client";

export type Topic = {
  id: number;
  slug: string;
  label: string;
  level: number;
  parent_id: number | null;
  is_active: boolean;
  intro?: string | null;
};

// Add article fetching for topics
export async function getTopicArticles(topicSlug: string, limit: number = 6) {
  // First get all topics that match this slug or are descendants
  const { data: topics, error: topicError } = await supabase
    .from('topics')
    .select('id, slug, level, parent_id')
    .eq('is_active', true);
  
  if (topicError) throw topicError;
  
  const currentTopic = topics?.find(t => t.slug === topicSlug);
  if (!currentTopic) return [];
  
  // Get relevant topic IDs (current topic + children if it's L1 or L2)
  let relevantTopicIds = [currentTopic.id];
  
  if (currentTopic.level <= 2) {
    const children = topics?.filter(t => t.parent_id === currentTopic.id) || [];
    relevantTopicIds.push(...children.map(c => c.id));
    
    // For L1 topics, also include grandchildren
    if (currentTopic.level === 1) {
      const grandchildren = topics?.filter(t => children.some(c => c.id === t.parent_id)) || [];
      relevantTopicIds.push(...grandchildren.map(gc => gc.id));
    }
  }
  
  // Fetch drops that are associated with these topics
  const { data: drops, error: dropsError } = await supabase
    .from('drops')
    .select(`
      id,
      title,
      summary,
      url,
      image_url,
      published_at,
      type,
      sources:source_id(name, homepage_url),
      content_topics!inner(topic_id)
    `)
    .in('content_topics.topic_id', relevantTopicIds)
    .eq('tag_done', true)
    .order('published_at', { ascending: false })
    .limit(limit);
  
  if (dropsError) throw dropsError;
  
  // Transform to FeedCardProps format
  return drops?.map(drop => ({
    id: drop.id.toString(),
    type: drop.type === 'video' ? 'video' as const : 'article' as const,
    title: drop.title,
    summary: drop.summary || '',
    imageUrl: drop.image_url,
    publishedAt: drop.published_at || '',
    source: {
      name: drop.sources?.name || 'Unknown Source',
      url: drop.sources?.homepage_url || '#'
    },
    tags: [], // We could fetch this from content_topics if needed
    href: drop.url,
    youtubeId: drop.type === 'video' ? extractYouTubeId(drop.url) : undefined,
    isPremium: false
  })) || [];
}

function extractYouTubeId(url: string): string | undefined {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : undefined;
}

export async function getAllTopics(): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('id,slug,label,level,parent_id,is_active,intro')
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('label', { ascending: true });
  
  if (error) throw error;
  return data as any as Topic[] ?? [];
}

export async function getTopicBySlug(slug: string): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .select('id,slug,label,level,parent_id,is_active,intro')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  
  if (error) throw error;
  return data as any as Topic;
}

export async function getChildren(parentId: number): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('id,slug,label,level,parent_id,is_active,intro')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('label', { ascending: true });
  
  if (error) throw error;
  return data as any as Topic[] ?? [];
}

export async function getTopicWithChildren(slug: string): Promise<{
  topic: Topic;
  children: Topic[];
  grandchildren: Topic[];
}> {
  const topic = await getTopicBySlug(slug);
  const children = await getChildren(topic.id);
  
  // For L1 topics, also get L3 children for each L2
  let grandchildren: Topic[] = [];
  if (topic.level === 1) {
    const grandchildrenPromises = children.map(child => getChildren(child.id));
    const grandchildrenArrays = await Promise.all(grandchildrenPromises);
    grandchildren = grandchildrenArrays.flat();
  }
  
  return { topic, children, grandchildren };
}

export function groupTopicsByLevel(topics: Topic[]): Record<number, Topic[]> {
  return topics.reduce((acc, topic) => {
    if (!acc[topic.level]) {
      acc[topic.level] = [];
    }
    acc[topic.level].push(topic);
    return acc;
  }, {} as Record<number, Topic[]>);
}

export async function buildBreadcrumb(topic: Topic): Promise<Array<{ label: string; to: string }>> {
  const breadcrumb = [{ label: 'Topics', to: '/topics' }];
  
  // Build hierarchy from current topic up to root
  let current = topic;
  const hierarchy = [current];
  
  while (current.parent_id) {
    const { data: parent } = await supabase
      .from('topics')
      .select('id,slug,label,level,parent_id,is_active,intro')
      .eq('id', current.parent_id)
      .single();
    
    if (parent) {
      hierarchy.unshift(parent as any as Topic);
      current = parent as any as Topic;
    } else {
      break;
    }
  }
  
  // Add each level to breadcrumb
  hierarchy.forEach(item => {
    breadcrumb.push({
      label: item.label,
      to: `/topics/${item.slug}`
    });
  });
  
  return breadcrumb;
}