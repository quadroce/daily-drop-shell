import { useEffect } from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { track } from '@/lib/analytics';

export const AlphaRibbon = () => {
  const showRibbon = useFeatureFlag('show_alpha_ribbon');

  useEffect(() => {
    if (showRibbon) {
      track('alpha_ribbon_view');
    }
  }, [showRibbon]);

  if (!showRibbon) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-fade-in">
      <div className="bg-red-600 text-white rounded px-3 py-1 text-xs font-medium">
        ALPHA VERSION
      </div>
    </div>
  );
};