import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Seo } from "@/components/Seo";
import { useInfiniteFeed } from "@/hooks/useInfiniteFeed";
import { InfiniteFeedList } from "@/components/InfiniteFeedList";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

const Feed = () => {
  const navigate = useNavigate();
  const { profile: userProfile } = useUserProfile();
  const [userPreferences, setUserPreferences] = useState<{
    selectedTopicIds: number[];
    selectedLanguageIds: number[];
    languageCodes: string[];
  } | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      console.log('🔄 Loading preferences for user:', userProfile?.id);
      if (!userProfile?.id) {
        console.log('❌ No user profile ID available');
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('❌ No authenticated user found');
          return;
        }
        
        console.log('📡 Fetching preferences from database...');
        const { data: prefs } = await supabase
          .from('preferences')
          .select('selected_topic_ids, selected_language_ids')
          .eq('user_id', user.id)
          .maybeSingle();
          
        console.log('📋 Raw preferences data:', prefs);
        
        // Always set preferences - even if empty, so feed can load
        const preferences = {
          selectedTopicIds: prefs?.selected_topic_ids || [],
          selectedLanguageIds: prefs?.selected_language_ids || [],
          languageCodes: ['en'] // Default for now
        };
        
        console.log('✅ Setting user preferences:', preferences);
        setUserPreferences(preferences);
      } catch (error) {
        console.error('❌ Failed to load preferences:', error);
        // Set empty preferences instead of null to allow feed to load
        setUserPreferences({
          selectedTopicIds: [],
          selectedLanguageIds: [],
          languageCodes: ['en']
        });
      } finally {
        setPreferencesLoading(false);
      }
    };

    loadPreferences();
  }, [userProfile?.id]);

  // Check if user has meaningful preferences (but allow feed to load regardless)
  const hasValidPrefs = userPreferences && 
    userPreferences.selectedTopicIds && 
    userPreferences.selectedTopicIds.length > 0;
  
  console.log('🔍 Preferences validation:', {
    userPreferences,
    hasValidPrefs,
    selectedTopicIds: userPreferences?.selectedTopicIds,
    topicCount: userPreferences?.selectedTopicIds?.length
  });

  const {
    items,
    load,
    loading,
    hasMore,
    error,
    initialLoading,
    reset
  } = useInfiniteFeed({
    userId: userProfile?.id || null,
    language: userPreferences?.languageCodes?.[0] || null,
    l1: null, // No filters for now - show all content
    l2: null
  });

  // Require authentication
  useEffect(() => {
    requireSession();
  }, []);

  // Initial loading state (including preferences loading)
  if (initialLoading || preferencesLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Today's Drops
          </h1>
          <p className="text-muted-foreground">
            Curated content based on your interests
          </p>
        </div>

        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="w-28 h-28 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show preferences setup if user has no preferences (but let feed load first)
  // Temporarily disable this to allow feed to show even without preferences
  if (false && !hasValidPrefs) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-16">
          <div className="space-y-6">
            <div className="space-y-2">
              <Settings className="h-16 w-16 text-muted-foreground mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">
                Setup Your Preferences
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                To get personalized daily drops, please set up your topic and
                language preferences first.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                onClick={() => navigate("/preferences")}
                className="px-8"
              >
                <Settings className="h-4 w-4 mr-2" />
                Set Up Preferences
              </Button>
              <p className="text-xs text-muted-foreground">
                Choose your interests and languages to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo
        title="Your Daily Content Feed - DailyDrops"
        description="Discover personalized content curated by AI based on your interests. Get daily tech updates, insights, and trending topics delivered to your feed."
        canonical="https://dailydrops.cloud/feed"
        noindex={!hasValidPrefs}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "DailyDrops Personal Feed",
          "description":
            "Personalized content discovery feed with AI-curated articles, videos, and insights",
          "isPartOf": {
            "@type": "WebSite",
            "name": "DailyDrops",
            "url": "https://dailydrops.cloud",
          },
        }}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Your Feed
            </h1>
            <p className="text-muted-foreground">
              Infinite scroll feed ranked by relevance
            </p>
          </div>
          
          {error && (
            <Button onClick={reset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>

        <div className="min-h-screen">
          <InfiniteFeedList
            items={items}
            load={load}
            hasMore={hasMore}
            loading={loading}
            error={error}
            onRetry={reset}
          />
        </div>
      </div>
    </>
  );
};

export default Feed;