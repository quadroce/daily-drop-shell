import { supabase } from "@/integrations/supabase/client";

export type Topic = {
  id: number;
  slug: string;
  label: string;
  level: number;
  parent_id: number | null;
  is_active: boolean;
};

export async function getAllTopics(): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('id,slug,label,level,parent_id,is_active')
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('label', { ascending: true });
  
  if (error) throw error;
  return data ?? [];
}

export async function getTopicBySlug(slug: string): Promise<Topic> {
  const { data, error } = await supabase
    .from('topics')
    .select('id,slug,label,level,parent_id,is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  
  if (error) throw error;
  return data as Topic;
}

export async function getChildren(parentId: number): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('id,slug,label,level,parent_id,is_active')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('label', { ascending: true });
  
  if (error) throw error;
  return data ?? [];
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
      .select('id,slug,label,level,parent_id,is_active')
      .eq('id', current.parent_id)
      .single();
    
    if (parent) {
      hierarchy.unshift(parent as Topic);
      current = parent as Topic;
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