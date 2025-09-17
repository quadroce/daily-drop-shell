import { MessageSquare } from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { track } from '@/lib/analytics';

const FEEDBACK_URL = 'https://forms.gle/gPYeQy6DTuQYoLnaA';

export const FeedbackFab = () => {
  const showButton = useFeatureFlag('show_feedback_button');

  const handleClick = () => {
    track('feedback_button_click', { url: FEEDBACK_URL });
    window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer');
  };

  if (!showButton) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in">
      <button
        onClick={handleClick}
        aria-label="Open feedback form"
        className="inline-flex items-center gap-2 rounded-full shadow-lg px-4 py-3 bg-background text-foreground border border-border hover:shadow-xl hover:scale-105 transition-all duration-200"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">Feedback</span>
      </button>
    </div>
  );
};