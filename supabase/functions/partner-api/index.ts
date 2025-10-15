import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET /partner-api?action=getBySlug&slug=aws
    if (action === 'getBySlug' && req.method === 'GET') {
      const slug = url.searchParams.get('slug');
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

      return new Response(
        JSON.stringify({
          partner,
          links: links || [],
          topics: topics?.map(t => t.topics) || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /partner-api?action=feed&slug=aws&cursor=...
    if (action === 'feed' && req.method === 'GET') {
      const slug = url.searchParams.get('slug');
      const cursor = url.searchParams.get('cursor');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!slug) {
        return new Response(JSON.stringify({ error: 'Slug required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get partner and topics
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

      if (topicIds.length === 0) {
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
          sources(name)
        `)
        .eq('tag_done', true)
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      // Get content topics to filter by partner topics
      const { data: contentTopics } = await supabaseClient
        .from('content_topics')
        .select('content_id')
        .in('topic_id', topicIds);

      const contentIds = [...new Set(contentTopics?.map(ct => ct.content_id) || [])];

      if (contentIds.length === 0) {
        return new Response(
          JSON.stringify({ items: [], nextCursor: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      query = query.in('id', contentIds);

      if (cursor) {
        const [timestamp, id] = cursor.split('_');
        query = query.or(`published_at.lt.${timestamp},and(published_at.eq.${timestamp},id.lt.${id})`);
      }

      const { data: drops, error } = await query;

      if (error) {
        console.error('Feed query error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hasMore = drops && drops.length > limit;
      const items = hasMore ? drops.slice(0, limit) : drops || [];
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
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { slug, name, status, scheduled_at, banner_url, youtube_url, description_md, links, topicIds } = body;

      if (!links || links.length !== 2) {
        return new Response(JSON.stringify({ error: 'Exactly 2 links required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: partner, error: partnerError } = await supabaseClient
        .from('partners')
        .insert({
          slug,
          name,
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

      // Insert links
      const linkData = links.map((link: any, idx: number) => ({
        partner_id: partner.id,
        position: idx + 1,
        label: link.label,
        url: link.url,
        utm: link.utm,
      }));

      await supabaseClient.from('partner_links').insert(linkData);

      // Insert topics
      if (topicIds && topicIds.length > 0) {
        const topicData = topicIds.map((tid: number) => ({
          partner_id: partner.id,
          topic_id: tid,
        }));
        await supabaseClient.from('partner_topics').insert(topicData);
      }

      return new Response(JSON.stringify({ partner }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /partner-api?action=update
    if (action === 'update' && req.method === 'PATCH') {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { id, slug, name, status, scheduled_at, banner_url, youtube_url, description_md, links, topicIds } = body;

      const { data: partner, error: partnerError } = await supabaseClient
        .from('partners')
        .update({
          slug,
          name,
          status,
          scheduled_at,
          banner_url,
          youtube_url,
          description_md,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (partnerError) {
        return new Response(JSON.stringify({ error: partnerError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (links && links.length === 2) {
        await supabaseClient.from('partner_links').delete().eq('partner_id', id);
        const linkData = links.map((link: any, idx: number) => ({
          partner_id: id,
          position: idx + 1,
          label: link.label,
          url: link.url,
          utm: link.utm,
        }));
        await supabaseClient.from('partner_links').insert(linkData);
      }

      if (topicIds) {
        await supabaseClient.from('partner_topics').delete().eq('partner_id', id);
        if (topicIds.length > 0) {
          const topicData = topicIds.map((tid: number) => ({
            partner_id: id,
            topic_id: tid,
          }));
          await supabaseClient.from('partner_topics').insert(topicData);
        }
      }

      return new Response(JSON.stringify({ partner }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /partner-api?action=publish
    if (action === 'publish' && req.method === 'POST') {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { id, scheduled_at } = body;

      const { data: partner, error } = await supabaseClient
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
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
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
        const { data: existingPrefs } = await supabaseClient
          .from('preferences')
          .select('selected_topic_ids')
          .eq('user_id', user.id)
          .single();

        const currentTopics = existingPrefs?.selected_topic_ids || [];
        const newTopics = [...new Set([...currentTopics, ...topicIds])];

        await supabaseClient
          .from('preferences')
          .upsert({
            user_id: user.id,
            selected_topic_ids: newTopics,
            updated_at: new Date().toISOString(),
          });
      }

      // Track follow event
      await supabaseClient
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

      const { data: { user } } = await supabaseClient.auth.getUser();

      await supabaseClient
        .from('partner_events')
        .insert({
          partner_id: partner.id,
          user_id: user?.id || null,
          type,
          meta,
        });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /partner-api?action=list
    if (action === 'list' && req.method === 'GET') {
      const { data: partners, error } = await supabaseClient
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
