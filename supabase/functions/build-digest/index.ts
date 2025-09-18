import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { renderTemplate } from "../_shared/email-template.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BuildDigestRequest {
  userId: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  slot: 'morning' | 'afternoon' | 'evening';
  testMode?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { userId, cadence, slot, testMode = false }: BuildDigestRequest = await req.json();
    
    console.log(`Building digest for user ${userId}, cadence: ${cadence}, slot: ${slot}, test: ${testMode}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info including language preferences
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('email, display_name, first_name, subscription_tier, language_prefs')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user preferences to find their topics
    const { data: preferences, error: prefsError } = await supabase
      .from('preferences')
      .select('selected_topic_ids')
      .eq('user_id', userId)
      .single();

    if (prefsError) {
      console.log('No preferences found for user, using default content');
    }

    // Determine time window based on cadence
    let timeWindow = '';
    const now = new Date();
    
    switch (cadence) {
      case 'daily':
        timeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'weekly':
        timeWindow = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'monthly':
        timeWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }

    // Get relevant content based on user's topics, languages and time window
    let dropsQuery = supabase
      .from('drops')
      .select('id, title, url, summary, image_url, published_at, tags, lang_code')
      .eq('tag_done', true)
      .order('published_at', { ascending: false });

    if (timeWindow) {
      dropsQuery = dropsQuery.gte('published_at', timeWindow);
    }

    // Filter by language preferences first (up to 3 languages)
    if (user.language_prefs && user.language_prefs.length > 0) {
      console.log(`Filtering by user language preferences: ${user.language_prefs.join(', ')}`);
      dropsQuery = dropsQuery.in('lang_code', user.language_prefs);
    }

    // If user has topic preferences, filter by them
    if (preferences?.selected_topic_ids?.length > 0) {
      // Get topic slugs from IDs
      const { data: topics } = await supabase
        .from('topics')
        .select('slug')
        .in('id', preferences.selected_topic_ids);

      const topicSlugs = topics?.map(t => t.slug) || [];
      if (topicSlugs.length > 0) {
        dropsQuery = dropsQuery.overlaps('tags', topicSlugs);
      }
    }

    // Try to get preferred content first
    const { data: preferredDrops, error: dropsError } = await dropsQuery.limit(testMode ? 5 : 10);

    let drops = preferredDrops;
    
    // If we don't have enough items with language filtering, get more without language filter
    if (!dropsError && drops && drops.length < (testMode ? 3 : 5)) {
      console.log(`Only found ${drops.length} items with language preferences, getting more without language filter...`);
      
      let fallbackQuery = supabase
        .from('drops')
        .select('id, title, url, summary, image_url, published_at, tags, lang_code')
        .eq('tag_done', true)
        .order('published_at', { ascending: false });

      if (timeWindow) {
        fallbackQuery = fallbackQuery.gte('published_at', timeWindow);
      }

      // Still filter by topics if available
      if (preferences?.selected_topic_ids?.length > 0) {
        const { data: topics } = await supabase
          .from('topics')
          .select('slug')
          .in('id', preferences.selected_topic_ids);

        const topicSlugs = topics?.map(t => t.slug) || [];
        if (topicSlugs.length > 0) {
          fallbackQuery = fallbackQuery.overlaps('tags', topicSlugs);
        }
      }

      const { data: fallbackDrops } = await fallbackQuery.limit(testMode ? 5 : 10);
      
      if (fallbackDrops) {
        // Merge and deduplicate
        const existingIds = new Set(drops.map(d => d.id));
        const additionalDrops = fallbackDrops.filter(d => !existingIds.has(d.id));
        drops = [...drops, ...additionalDrops].slice(0, testMode ? 5 : 10);
        console.log(`Added ${additionalDrops.length} fallback items, total: ${drops.length}`);
      }
    }

    if (dropsError) {
      console.error('Error fetching drops:', dropsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Graceful degradation: send fewer items rather than skipping entirely
    if (!drops || drops.length === 0) {
      console.log('No content found for user preferences, trying without filters...');
      
      // Last resort: get any recent content
      const { data: anyDrops } = await supabase
        .from('drops')
        .select('id, title, url, summary, image_url, published_at, tags, lang_code')
        .eq('tag_done', true)
        .order('published_at', { ascending: false })
        .limit(testMode ? 3 : 5);
      
      drops = anyDrops || [];
      console.log(`Found ${drops.length} fallback items`);
    }

    // If still no content, that's okay - send empty digest with explanation
    if (drops.length === 0) {
      console.log('Absolutely no content available, sending empty digest');
    }

    // Format content for email template
    const digestContent = {
      user: {
        name: user.display_name || user.first_name || user.email.split('@')[0],
        email: user.email,
        subscription_tier: user.subscription_tier,
      },
      digest: {
        cadence,
        slot,
        date: now.toISOString().split('T')[0],
        items: drops.map(drop => ({
          title: drop.title,
          summary: drop.summary || '',
          url: `${drop.url}?utm_source=newsletter&utm_medium=email&utm_campaign=daily_drop&utm_content=${cadence}`,
          image_url: drop.image_url,
          published_at: drop.published_at,
          tags: drop.tags || [],
          lang_code: drop.lang_code,
        })),
      },
      testMode,
    };

    // Render HTML email template
    const htmlContent = renderTemplate(digestContent);

    console.log(`Successfully built digest with ${drops.length} items for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        digestContent,
        htmlContent,
        itemCount: drops.length,
        timeWindow,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in build-digest:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});