import { useInfiniteQuery } from '@tanstack/react-query';
import { getTopicArticles } from '@/lib/topics';

const ARTICLES_PER_PAGE = 12;

export const useInfiniteTopicArticles = (topicSlug: string) => {
  return useInfiniteQuery({
    queryKey: ['topic-articles-infinite', topicSlug],
    queryFn: async ({ pageParam }) => {
      const result = await getTopicArticles(topicSlug, ARTICLES_PER_PAGE, pageParam);
      return result;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};