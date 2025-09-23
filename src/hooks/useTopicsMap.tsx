import { useState, useEffect, useMemo } from 'react';
import { fetchTopicsTree, TopicTreeItem } from '@/lib/api/topics';

type TopicsMap = Map<string, string>; // label -> slug

export const useTopicsMap = () => {
  const [topics, setTopics] = useState<TopicTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        setIsLoading(true);
        const fetchedTopics = await fetchTopicsTree();
        console.log('🔍 Topics loaded:', fetchedTopics);
        setTopics(fetchedTopics);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load topics');
        console.error('Error loading topics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTopics();
  }, []);

  const topicsMap = useMemo(() => {
    const map = new Map<string, string>();
    topics.forEach(topic => {
      map.set(topic.label, topic.slug);
    });
    console.log('🗺️ Topics map created:', Object.fromEntries(map));
    return map;
  }, [topics]);

  const getTopicSlug = (label: string): string | null => {
    return topicsMap.get(label) || null;
  };

  return {
    topicsMap,
    getTopicSlug,
    isLoading,
    error,
    topics
  };
};