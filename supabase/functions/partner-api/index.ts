import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with optional authorization
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      authHeader ? {
        global: {
          headers: { Authorization: authHeader },
        },
      } : {}
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    console.log('[REQUEST] Method:', req.method, 'Action:', action);

    // GET /partner-api?action=getBySlug&slug=aws
    if (action === 'getBySlug' && req.method === 'GET') {
      const slug = url.searchParams.get('slug');
      console.log('[getBySlug] Requested slug:', slug);
      console.log('[getBySlug] Has auth header:', !!req.headers.get('Authorization'));
      
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Slug required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: partner, error: partnerError } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('slug', slug)
        .single();
      
      console.log('[getBySlug] Partner found:', !!partner);
      console.log('[getBySlug] Error:', partnerError?.message);

      if (partnerError || !partner) {
        return new Response(JSON.stringify({ error: 'Partner not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: links } = await supabaseClient
        .from('partner_links')
        .select('*')
        .eq('partner_id', partner.id)
        .order('position');

      const { data: topics } = await supabaseClient
        .from('partner_topics')
        .select('topic_id, topics(id, slug, label)')
        .eq('partner_id', partner.id);

      // Check if user is following this partner
      let isFollowing = false;
      if (authHeader) {
        const adminClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await adminClient.auth.getUser(token);

        if (user) {
          const partnerTopicIds = topics?.map(t => t.topic_id) || [];
          
          if (partnerTopicIds.length > 0) {
            const { data: userPrefs } = await adminClient
              .from('preferences')
              .select('selected_topic_ids')
              .eq('user_id', user.id)
              .maybeSingle();

            if (userPrefs?.selected_topic_ids) {
              // Check if ALL partner topics are in user's preferences
              isFollowing = partnerTopicIds.every(topicId => 
                userPrefs.selected_topic_ids.includes(topicId)
              );
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          partner,
          links: links || [],
          topics: topics?.map(t => t.topics) || [],
          is_following: isFollowing,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /partner-api?action=feed&slug=aws&cursor=...
    if (action === 'feed' && req.method === 'GET') {
      const slug = url.searchParams.get('slug');
      const cursor = url.searchParams.get('cursor');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      console.log('[feed] Requested slug:', slug);
      console.log('[feed] Has auth header:', !!authHeader);

      if (!slug) {
        return new Response(JSON.stringify({ error: 'Slug required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get partner with allowed language codes
      const { data: partner, error: partnerError } = await supabaseClient
        .from('partners')
        .select('id, allowed_language_codes')
        .eq('slug', slug)
        .single();
      
      console.log('[feed] Partner query - found:', !!partner, 'error:', partnerError?.message);

      if (!partner) {
        return new Response(JSON.stringify({ error: 'Partner not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: partnerTopics, error: topicsError } = await supabaseClient
        .from('partner_topics')
        .select('topic_id')
        .eq('partner_id', partner.id);
      
      console.log('[feed] Partner topics query - count:', partnerTopics?.length, 'error:', topicsError?.message);

      const topicIds = partnerTopics?.map(pt => pt.topic_id) || [];

      if (topicIds.length === 0) {
        console.log('[feed] No topics found for partner');
        return new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build query
      let query = supabaseClient
        .from('drops')
        .select(`
          id,
          title,
          url,
          image_url,
          summary,
          type,
          tags,
          source_id,
          published_at,
          created_at,
          youtube_video_id,
          youtube_thumbnail_url,
          youtube_duration_seconds,
          youtube_view_count,
          l1_topic_id,
          l2_topic_id,
          language_code,
          sources(name)
        `)
        .eq('tag_done', true)
        .not('published_at', 'is', null)
        .gte('published_at', '2020-01-01T00:00:00Z')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      // Filter by partner's allowed languages (if configured)
      if (partner.allowed_language_codes && partner.allowed_language_codes.length > 0) {
        query = query.in('language_code', partner.allowed_language_codes);
      }

      // Get content topics to filter by partner topics
      const { data: contentTopics, error: contentTopicsError } = await supabaseClient
        .from('content_topics')
        .select('content_id')
        .in('topic_id', topicIds);
      
      console.log('[feed] Content topics query - count:', contentTopics?.length, 'error:', contentTopicsError?.message);

      const contentIds = [...new Set(contentTopics?.map(ct => ct.content_id) || [])];

      if (contentIds.length === 0) {
        console.log('[feed] No content found for topics');
        return new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[feed] Content IDs to fetch:', contentIds.length);

      query = query.in('id', contentIds);

      if (cursor) {
        const [timestamp, id] = cursor.split('_');
        query = query.or(`published_at.lt.${timestamp},and(published_at.eq.${timestamp},id.lt.${id})`);
      }

      const { data: drops, error } = await query;
      
      console.log('[feed] Drops query - count:', drops?.length, 'error:', error?.message);

      if (error) {
        console.error('[feed] Feed query error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hasMore = drops && drops.length > limit;
      const rawItems = hasMore ? drops.slice(0, limit) : drops || [];
      
      // Transform items to match FeedItem format
      const items = rawItems.map((drop: any) => {
        const publishedDate = new Date(drop.published_at);
        const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        const isFresh = daysSincePublished <= 3;
        
        return {
          ...drop,
          source_name: drop.sources?.name || 'Unknown Source',
          reason_for_ranking: isFresh ? 'Fresh content' : 'Relevant content',
          final_score: 0.5,
        };
      });
      
      const nextCursor = hasMore && items.length > 0
        ? `${items[items.length - 1].published_at}_${items[items.length - 1].id}`
        : null;

      return new Response(
        JSON.stringify({ items, nextCursor }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /partner-api?action=create
    if (action === 'create' && req.method === 'POST') {
      // For admin operations with verify_jwt=false, create admin client to verify auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create admin client to verify the JWT
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { slug, name, title, logo_url, status, scheduled_at, banner_url, youtube_url, description_md, links, topicIds } = body;

      const { data: partner, error: partnerError } = await adminClient
        .from('partners')
        .insert({
          slug,
          name,
          title,
          logo_url,
          status: status || 'draft',
          scheduled_at,
          banner_url,
          youtube_url,
          description_md,
          created_by: user.id,
        })
        .select()
        .single();

      if (partnerError) {
        return new Response(JSON.stringify({ error: partnerError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert links (only non-empty)
      if (links && links.length > 0) {
        const validLinks = links.filter((l: any) => l.label && l.url);
        if (validLinks.length > 0) {
          const linkData = validLinks.map((link: any, idx: number) => ({
            partner_id: partner.id,
            position: idx + 1,
            label: link.label,
            url: link.url,
            utm: link.utm || null,
          }));
          await adminClient.from('partner_links').insert(linkData);
        }
      }

      // Insert topics
      if (topicIds && topicIds.length > 0) {
        const topicData = topicIds.map((tid: number) => ({
          partner_id: partner.id,
          topic_id: tid,
        }));
        await adminClient.from('partner_topics').insert(topicData);
      }

      return new Response(JSON.stringify({ partner }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /partner-api?action=update
    if (action === 'update' && req.method === 'PATCH') {
      console.log('[UPDATE] Request received');
      
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        console.error('[UPDATE] No auth header');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !user) {
        console.error('[UPDATE] Auth failed:', authError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[UPDATE] User authenticated:', user.id);
      
      const body = await req.json();
      console.log('[UPDATE] Body received, id:', body.id);
      const { id, slug, name, title, logo_url, status, scheduled_at, banner_url, youtube_url, description_md, links, topicIds } = body;

      const updateData: any = {
        slug,
        name,
        title,
        logo_url,
        status,
        banner_url,
        youtube_url,
        description_md,
        updated_at: new Date().toISOString(),
      };

      if (status === 'scheduled' && scheduled_at) {
        updateData.scheduled_at = scheduled_at;
      } else {
        updateData.scheduled_at = null;
      }

      console.log('[UPDATE] Updating partner');
      const { data: partner, error: partnerError } = await adminClient
        .from('partners')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (partnerError) {
        console.error('[UPDATE] Error:', partnerError.message);
        return new Response(JSON.stringify({ error: partnerError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[UPDATE] Partner updated');

      if (links !== undefined) {
        console.log('[update] Updating links:', links);
        await adminClient.from('partner_links').delete().eq('partner_id', id);
        const validLinks = links.filter((l: any) => l.label && l.url);
        if (validLinks.length > 0) {
          const linkData = validLinks.map((link: any, idx: number) => ({
            partner_id: id,
            position: idx + 1,
            label: link.label,
            url: link.url,
            utm: link.utm || null,
          }));
          const { error: linkError } = await adminClient.from('partner_links').insert(linkData);
          if (linkError) {
            console.error('[update] Links insert error:', linkError.message);
          } else {
            console.log('[update] Links updated successfully');
          }
        }
      }

      if (topicIds !== undefined) {
        console.log('[update] Updating topics:', topicIds);
        await adminClient.from('partner_topics').delete().eq('partner_id', id);
        if (topicIds.length > 0) {
          const topicData = topicIds.map((tid: number) => ({
            partner_id: id,
            topic_id: tid,
          }));
          const { error: topicError } = await adminClient.from('partner_topics').insert(topicData);
          if (topicError) {
            console.error('[update] Topics insert error:', topicError.message);
          } else {
            console.log('[update] Topics updated successfully');
          }
        }
      }

      console.log('[update] Update completed successfully');
      return new Response(JSON.stringify({ partner }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /partner-api?action=publish
    if (action === 'publish' && req.method === 'POST') {
      // For admin operations with verify_jwt=false, create admin client to verify auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create admin client to verify the JWT
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { id, scheduled_at } = body;

      const { data: partner, error } = await adminClient
        .from('partners')
        .update({
          status: scheduled_at ? 'scheduled' : 'published',
          scheduled_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ partner }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /partner-api?action=follow
    if (action === 'follow' && req.method === 'POST') {
      // For user operations with verify_jwt=false, create admin client to verify auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create admin client to verify the JWT
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { slug } = body;

      const { data: partner } = await supabaseClient
        .from('partners')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!partner) {
        return new Response(JSON.stringify({ error: 'Partner not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: partnerTopics } = await supabaseClient
        .from('partner_topics')
        .select('topic_id')
        .eq('partner_id', partner.id);

      const topicIds = partnerTopics?.map(pt => pt.topic_id) || [];

      if (topicIds.length > 0) {
        // Get existing preferences
        const { data: existingPrefs } = await adminClient
          .from('preferences')
          .select('selected_topic_ids, selected_language_ids')
          .eq('user_id', user.id)
          .maybeSingle();

        const currentTopics = existingPrefs?.selected_topic_ids || [];
        const currentLanguages = existingPrefs?.selected_language_ids || [];
        const newTopics = [...new Set([...currentTopics, ...topicIds])];

        const { error: upsertError } = await adminClient
          .from('preferences')
          .upsert({
            user_id: user.id,
            selected_topic_ids: newTopics,
            selected_language_ids: currentLanguages,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (upsertError) {
          console.error('[follow] Upsert error:', upsertError);
          return new Response(JSON.stringify({ error: upsertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Track follow event
      await adminClient
        .from('partner_events')
        .insert({
          partner_id: partner.id,
          user_id: user.id,
          type: 'follow_click',
        });

      return new Response(
        JSON.stringify({ ok: true, followed_topics: topicIds.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /partner-api?action=track
    if (action === 'track' && req.method === 'POST') {
      const body = await req.json();
      const { slug, type, meta } = body;

      const { data: partner } = await supabaseClient
        .from('partners')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!partner) {
        return new Response(JSON.stringify({ error: 'Partner not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user if authenticated, otherwise null
      let userId = null;
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        userId = user?.id || null;
      } catch (error) {
        // User not authenticated, continue with null userId
        console.log('[track] User not authenticated');
      }

      // Insert event without selecting result to avoid RLS policy evaluation
      const { error: insertError } = await supabaseClient
        .from('partner_events')
        .insert({
          partner_id: partner.id,
          user_id: userId,
          type,
          meta,
        });

      if (insertError) {
        console.error('[track] Insert error:', insertError);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /partner-api?action=list
    if (action === 'list' && req.method === 'GET') {
      // For admin operations with verify_jwt=false, create admin client to verify auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create admin client to verify the JWT
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: partners, error } = await adminClient
        .from('partners')
        .select('*, partner_kpi(*)')
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ partners }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
