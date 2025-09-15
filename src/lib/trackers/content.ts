import { track } from '@/lib/analytics';

type BaseContentParams = {
  drop_id?: string | number;
  content_id?: string | number;
  source?: string;
  topic?: string;
  topic_l1?: string;
  topic_l2?: string;
  topic_l3?: string;
  position?: number;
  score?: number;
  is_premium?: boolean;
};

// New GA4 Events
export const trackDropViewed = (params: { drop_id?: string | number; topic?: string }) => {
  track('drop_viewed', params);
};

export const trackContentClick = (params: BaseContentParams) => {
  track('content_click', params);
};

export const trackSaveItem = (params: BaseContentParams) => {
  track('save_item', params);
};

export const trackDismissItem = (params: BaseContentParams) => {
  track('dismiss_item', params);
};

export const trackLikeItem = (params: BaseContentParams) => {
  track('like_item', params);
};

export const trackDislikeItem = (params: BaseContentParams) => {
  track('dislike_item', params);
};

// Video Events
export const trackVideoPlay = (params: { drop_id?: string | number; content_id?: string | number; percent_played?: number }) => {
  track('video_play', params);
};

export const trackVideoPause = (params: { drop_id?: string | number; content_id?: string | number; percent_played?: number }) => {
  track('video_pause', params);
};

export const trackVideoComplete = (params: { drop_id?: string | number; content_id?: string | number }) => {
  track('video_complete', params);
};

// Legacy exports (keep for compatibility)
export const trackOpen = (p: BaseContentParams) => track('open_item', p);
export const trackSave = (p: BaseContentParams) => track('save_item', p);
export const trackDismiss = (p: BaseContentParams) => track('dismiss_item', p);
export const trackLike = (p: BaseContentParams) => track('like_item', p);
export const trackDislike = (p: BaseContentParams) => track('dislike_item', p);