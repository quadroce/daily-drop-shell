import { track } from '@/lib/analytics';

type BaseParams = {
  content_id: string;
  source?: string;
  topic_l1?: string;
  topic_l2?: string;
  topic_l3?: string;
  position?: number;
  score?: number;
  is_premium?: boolean;
};

export const trackOpen = (p: BaseParams) => track('open_item', p);
export const trackSave = (p: BaseParams) => track('save_item', p);
export const trackDismiss = (p: BaseParams) => track('dismiss_item', p);
export const trackLike = (p: BaseParams) => track('like_item', p);
export const trackDislike = (p: BaseParams) => track('dislike_item', p);