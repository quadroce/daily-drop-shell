import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JWTPayload {
  sub: string;
  app_metadata?: {
    role?: string;
  };
}

interface JWTDecodeResult {
  success: boolean;
  payload?: JWTPayload;
  error?: 'missing' | 'empty' | 'malformed' | 'invalid_structure';
}

function decodeJWT(token: string): JWTDecodeResult {
  if (!token) {
    return { success: false, error: 'missing' };
  }
  
  if (token.trim() === '') {
    return { success: false, error: 'empty' };
  }
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { success: false, error: 'invalid_structure' };
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return { success: true, payload };
  } catch (error) {
    console.error('JWT decode error:', error);
    return { success: false, error: 'malformed' };
  }
}

interface AdminValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: 'no_auth' | 'invalid_token' | 'no_profile' | 'insufficient_role' | 'auth_error';
  errorMessage?: string;
  userRole?: string;
}

async function validateAdminRole(authHeader: string | null): Promise<AdminValidationResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      valid: false, 
      error: 'no_auth',
      errorMessage: 'No authentication token provided. Please login to continue.'
    };
  }

  const token = authHeader.substring(7);
  const jwtResult = decodeJWT(token);
  
  if (!jwtResult.success) {
    let errorMessage = 'Invalid authentication token.';
    switch (jwtResult.error) {
      case 'missing':
      case 'empty':
        errorMessage = 'Authentication token is missing. Please login again.';
        break;
      case 'malformed':
        errorMessage = 'Authentication token is corrupted. Please login again.';
        break;
      case 'invalid_structure':
        errorMessage = 'Authentication token has invalid format. Please login again.';
        break;
    }
    
    return { 
      valid: false, 
      error: 'invalid_token',
      errorMessage 
    };
  }

  // Check role from profiles table instead of JWT metadata
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', jwtResult.payload!.sub)
      .single();

    if (error) {
      console.log('Error fetching user profile:', error);
      return { 
        valid: false, 
        error: 'no_profile',
        errorMessage: 'User profile not found. Please contact an administrator.'
      };
    }

    const userRole = profile?.role;
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    
    if (!isAdmin) {
      console.log(`Access denied: user role '${userRole}' is not admin or superadmin`);
      return { 
        valid: false, 
        error: 'insufficient_role',
        errorMessage: `Access denied. Your role '${userRole}' does not have administrative privileges.`,
        userRole
      };
    }

    return { valid: true, payload: jwtResult.payload };
  } catch (error) {
    console.log('Error validating admin role:', error);
    return { 
      valid: false, 
      error: 'auth_error',
      errorMessage: 'Authentication service error. Please try again later.'
    };
  }
}

async function createSource(req: Request, authHeader: string) {
  const { name, homepage_url, feed_url, official = false } = await req.json();
  
  if (!name || !homepage_url) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: name, homepage_url' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data, error } = await supabase
    .from('sources')
    .insert({
      name,
      homepage_url,
      feed_url: feed_url || null,
      official,
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating source:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, source: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function enqueueItem(req: Request, authHeader: string) {
  const { source_id, url } = await req.json();
  
  if (!source_id || !url) {
    return new Response(JSON.stringify({ 
      error: 'Missing required fields: source_id, url' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Use upsert to handle ON CONFLICT DO NOTHING behavior
  const { data, error } = await supabase
    .from('ingestion_queue')
    .upsert({
      source_id,
      url,
      status: 'pending',
      tries: 0,
    }, {
      onConflict: 'url',
      ignoreDuplicates: true
    })
    .select();

  if (error) {
    console.error('Error enqueuing item:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const wasInserted = data && data.length > 0;
  
  return new Response(JSON.stringify({ 
    success: true, 
    inserted: wasInserted,
    message: wasInserted ? 'Item enqueued successfully' : 'Item already exists in queue'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function retryQueueItem(req: Request, authHeader: string) {
  const { queue_id } = await req.json();
  
  if (!queue_id) {
    return new Response(JSON.stringify({ 
      error: 'Missing required field: queue_id' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // First get the current tries count
  const { data: currentItem, error: fetchError } = await supabase
    .from('ingestion_queue')
    .select('tries')
    .eq('id', queue_id)
    .single();

  if (fetchError) {
    console.error('Error fetching queue item:', fetchError);
    return new Response(JSON.stringify({ error: 'Queue item not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update status to pending and increment tries
  const { data, error } = await supabase
    .from('ingestion_queue')
    .update({
      status: 'pending',
      tries: currentItem.tries + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', queue_id)
    .select()
    .single();

  if (error) {
    console.error('Error retrying queue item:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    item: data,
    message: `Queue item ${queue_id} set to retry (attempt ${data.tries})`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function youtubeReprocess(req: Request, authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const youtubeiApiKey = Deno.env.get('YOUTUBE_API_KEY');
  
  if (!youtubeiApiKey) {
    console.error('YOUTUBE_API_KEY not configured');
    return new Response(JSON.stringify({
      success: false,
      error: 'YouTube API key not configured'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Starting YouTube reprocessing workflow...');
  
  try {
    // Get total count of problematic videos
    const { count: totalProblematic } = await supabase
      .from('drops')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'video')
      .like('url', '%youtube.com%')
      .or(`title.like.- YouTube%,youtube_video_id.is.null`);
    
    console.log(`Found ${totalProblematic} problematic YouTube videos`);
    
    if (!totalProblematic || totalProblematic === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No problematic YouTube videos found',
        totalProblematic: 0,
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get first batch of 10 problematic videos
    const { data: problematicVideos, error: fetchError } = await supabase
      .from('drops')
      .select('id, url, title')
      .eq('type', 'video')
      .like('url', '%youtube.com%')
      .or(`title.like.- YouTube%,youtube_video_id.is.null`)
      .order('id', { ascending: true })
      .limit(10);
    
    if (fetchError) {
      throw new Error(`Failed to fetch problematic videos: ${fetchError.message}`);
    }
    
    console.log(`Processing ${problematicVideos?.length || 0} videos in this batch`);
    
    let processed = 0;
    let errors = 0;
    const results = [];
    
    for (const video of problematicVideos || []) {
      try {
        // Extract video ID from URL
        const videoIdMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        if (!videoIdMatch) {
          console.error(`Could not extract video ID from URL: ${video.url}`);
          errors++;
          continue;
        }
        
        const videoId = videoIdMatch[1];
        console.log(`Processing video ID: ${videoId}`);
        
        // Call YouTube API
        const youtubeResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${youtubeiApiKey}`
        );
        
        if (!youtubeResponse.ok) {
          throw new Error(`YouTube API error: ${youtubeResponse.status} ${youtubeResponse.statusText}`);
        }
        
        const youtubeData = await youtubeResponse.json();
        
        if (!youtubeData.items || youtubeData.items.length === 0) {
          console.log(`No YouTube data found for video ID: ${videoId}`);
          errors++;
          continue;
        }
        
        const videoData = youtubeData.items[0];
        const snippet = videoData.snippet;
        const statistics = videoData.statistics;
        
        // Cache the metadata
        const { error: cacheError } = await supabase
          .from('youtube_cache')
          .upsert({
            video_id: videoId,
            title: snippet.title,
            description: snippet.description,
            channel_title: snippet.channelTitle,
            published_at: snippet.publishedAt,
            thumbnail_url: snippet.thumbnails?.maxresdefault?.url || snippet.thumbnails?.high?.url,
            view_count: statistics?.viewCount ? parseInt(statistics.viewCount) : null,
            like_count: statistics?.likeCount ? parseInt(statistics.likeCount) : null,
            comment_count: statistics?.commentCount ? parseInt(statistics.commentCount) : null
          });
        
        if (cacheError) {
          console.error(`Error caching YouTube data for ${videoId}:`, cacheError);
        }
        
        // Update the drop with proper metadata
        const { error: updateError } = await supabase
          .from('drops')
          .update({
            title: snippet.title,
            summary: snippet.description?.substring(0, 500) || '',
            image_url: snippet.thumbnails?.maxresdefault?.url || snippet.thumbnails?.high?.url,
            published_at: snippet.publishedAt,
            youtube_video_id: videoId,
            youtube_channel: snippet.channelTitle,
            popularity_score: statistics?.viewCount ? Math.log10(parseInt(statistics.viewCount)) : null,
            tag_done: false // Reset for re-tagging
          })
          .eq('id', video.id);
        
        if (updateError) {
          console.error(`Error updating drop ${video.id}:`, updateError);
          errors++;
        } else {
          processed++;
          results.push({
            id: video.id,
            videoId: videoId,
            title: snippet.title,
            success: true
          });
        }
        
        // Rate limiting: wait 100ms between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        errors++;
        results.push({
          id: video.id,
          error: error.message,
          success: false
        });
      }
    }
    
    const response = {
      success: true,
      message: `YouTube reprocessing batch completed`,
      totalProblematic,
      processed,
      errors,
      remaining: Math.max(0, totalProblematic - processed),
      results: results.slice(0, 5), // Show first 5 results
      instructions: {
        message: processed > 0 
          ? `Successfully processed ${processed} videos. ${Math.max(0, totalProblematic - processed)} videos remaining.`
          : 'No videos were processed successfully.',
        nextStep: Math.max(0, totalProblematic - processed) > 0 
          ? 'Run the process again to continue with the next batch'
          : 'All problematic videos have been processed'
      }
    };
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Failed YouTube reprocessing:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

// Users management functions
async function getUsers(req: Request, authHeader: string, body?: any): Promise<Response> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Read parameters from body (for POST requests) or URL (for GET requests)
    const params = body || {};
    const search = params.search || '';
    const tier = params.tier;
    const role = params.role;
    const lang = params.lang;
    const active = params.active !== 'false'; // default true
    const sort = params.sort || 'created_at';
    const page = parseInt(params.page || '1');
    const pageSize = parseInt(params.pageSize || '50');
    
    let query = supabase
      .from('profiles')
      .select(`
        id, email, display_name, username, first_name, last_name, 
        subscription_tier, role, language_prefs, youtube_embed_pref, 
        onboarding_completed, created_at, is_active, company_role
      `, { count: 'exact' })
      .eq('is_active', active);

    // Search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    // Tier filter  
    if (tier) {
      const tiers = tier.split(',');
      query = query.in('subscription_tier', tiers);
    }

    // Role filter
    if (role) {
      const roles = role.split(',');
      query = query.in('role', roles);
    }

    // Language filter
    if (lang) {
      query = query.contains('language_prefs', [lang]);
    }

    // Sorting
    const ascending = !sort.startsWith('-');
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    query = query.order(sortField, { ascending });

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({
      users: data,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting users:', error);
    return new Response(JSON.stringify({ error: 'Failed to get users' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function getUserById(req: Request, authHeader: string, userId: string): Promise<Response> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, email, display_name, username, first_name, last_name, 
        subscription_tier, role, language_prefs, youtube_embed_pref, 
        onboarding_completed, created_at, is_active, company_role
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting user:', error);
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function createUser(req: Request, authHeader: string, payload?: any): Promise<Response> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const body = payload || await req.json();
    const { email, display_name, subscription_tier = 'free', role = 'user' } = body;

    // Validate required fields
    if (!email || !display_name) {
      return new Response(JSON.stringify({ error: 'Email and display_name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current user for audit logging
    const { data: authUser } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    const currentUserId = authUser.user?.id;

    // Create auth user
    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { display_name },
    });

    if (authError) throw authError;

    // Create profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newAuthUser.user.id,
        email,
        display_name,
        subscription_tier,
        role,
        language_prefs: [],
        youtube_embed_pref: true,
        onboarding_completed: false,
        is_active: true
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // Send invite email
    await supabase.auth.admin.inviteUserByEmail(email);

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      user_id: currentUserId,
      action: 'create',
      resource_type: 'profile',
      resource_id: newAuthUser.user.id,
      details: { email, display_name, subscription_tier, role }
    });

    return new Response(JSON.stringify(profileData), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(JSON.stringify({ error: 'Failed to create user' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function updateUser(req: Request, authHeader: string, userId: string, payload?: any): Promise<Response> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Use provided payload or parse from request body (for backwards compatibility)
    const userData = payload || await req.json();
    const { 
      display_name, username, first_name, last_name, company_role,
      subscription_tier, role, language_prefs, youtube_embed_pref, 
      onboarding_completed, is_active 
    } = userData;

    // Get current user for role check and audit logging
    const { data: authUser } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    const currentUserId = authUser.user?.id;
    
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .single();

    // Get current target user profile to compare changes
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !currentProfile) {
      console.error('Error fetching current profile:', fetchError);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate language_prefs if provided
    if (language_prefs && language_prefs.length > 3) {
      return new Response(JSON.stringify({ error: 'Maximum 3 languages allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate language codes exist
    if (language_prefs && language_prefs.length > 0) {
      const { data: languages } = await supabase
        .from('languages')
        .select('code')
        .in('code', language_prefs);
      
      if (languages?.length !== language_prefs.length) {
        return new Response(JSON.stringify({ error: 'Invalid language codes' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Only admin can change roles
    if (role && currentUserProfile?.role !== 'admin' && currentUserProfile?.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Only admins can change user roles' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build update data - only include fields that have actually changed
    const updateData: any = {};
    if (display_name !== undefined && display_name !== currentProfile.display_name) {
      updateData.display_name = display_name;
    }
    if (first_name !== undefined && first_name !== currentProfile.first_name) {
      updateData.first_name = first_name;
    }
    if (last_name !== undefined && last_name !== currentProfile.last_name) {
      updateData.last_name = last_name;
    }
    if (company_role !== undefined && company_role !== currentProfile.company_role) {
      updateData.company_role = company_role;
    }
    if (subscription_tier !== undefined && subscription_tier !== currentProfile.subscription_tier) {
      updateData.subscription_tier = subscription_tier;
    }
    if (role !== undefined && role !== currentProfile.role) {
      updateData.role = role;
    }
    if (language_prefs !== undefined && JSON.stringify(language_prefs) !== JSON.stringify(currentProfile.language_prefs)) {
      updateData.language_prefs = language_prefs;
    }
    if (youtube_embed_pref !== undefined && youtube_embed_pref !== currentProfile.youtube_embed_pref) {
      updateData.youtube_embed_pref = youtube_embed_pref;
    }
    if (onboarding_completed !== undefined && onboarding_completed !== currentProfile.onboarding_completed) {
      updateData.onboarding_completed = onboarding_completed;
    }
    if (is_active !== undefined && is_active !== currentProfile.is_active) {
      updateData.is_active = is_active;
    }

    // Special handling for username - check for duplicates if it has changed
    if (username !== undefined && username !== currentProfile.username) {
      // Check if username already exists for another user
      if (username && username.trim() !== '') {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .neq('id', userId)
          .single();

        if (existingUser) {
          return new Response(JSON.stringify({ 
            error: 'Username already taken',
            details: 'This username is already in use by another user'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      updateData.username = username;
    }

    // If no fields have changed, return success without updating
    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify(currentProfile), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      
      // Handle specific PostgreSQL constraint violations
      if (error.code === '23505') {
        if (error.message.includes('profiles_username_key')) {
          return new Response(JSON.stringify({ 
            error: 'Username already taken',
            details: 'This username is already in use by another user'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ 
          error: 'Duplicate value',
          details: 'A field value you are trying to set already exists'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw error;
    }

    // Log admin action
    const action = is_active === false ? 'soft_delete' : 
                  role !== undefined ? 'role_change' :
                  subscription_tier !== undefined ? 'tier_change' : 'update';

    await supabase.from('admin_audit_log').insert({
      user_id: currentUserId,
      action,
      resource_type: 'profile',
      resource_id: userId,
      details: updateData
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return new Response(JSON.stringify({ error: 'Failed to update user' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function softDeleteUser(req: Request, authHeader: string, userId: string): Promise<Response> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get current user for audit logging
    const { data: authUser } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    const currentUserId = authUser.user?.id;

    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      user_id: currentUserId,
      action: 'soft_delete',
      resource_type: 'profile', 
      resource_id: userId,
      details: { is_active: false }
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error soft deleting user:', error);
    return new Response(JSON.stringify({ error: 'Failed to soft delete user' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function getLanguages(req: Request, authHeader: string): Promise<Response> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data, error } = await supabase
      .from('languages')
      .select('code, label')
      .order('label');

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting languages:', error);
    return new Response(JSON.stringify({ error: 'Failed to get languages' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate admin role
  const authHeader = req.headers.get('Authorization');
  const validation = await validateAdminRole(authHeader);
  
  if (!validation.valid) {
    const statusCode = validation.error === 'no_auth' || validation.error === 'invalid_token' ? 401 : 403;
    return new Response(JSON.stringify({ 
      error: validation.errorMessage || 'Unauthorized: Admin role required',
      errorType: validation.error,
      userRole: validation.userRole
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Route by pathname - handle both direct and function paths
  const url = new URL(req.url);
  let pathname = url.pathname;
  
  console.log('Original pathname:', pathname);
  
  // Extract the actual endpoint from Supabase function path
  if (pathname.startsWith('/functions/v1/admin-api/')) {
    pathname = pathname.replace('/functions/v1/admin-api', '');
    console.log('After functions/v1/admin-api replacement:', pathname);
  } else if (pathname.startsWith('/admin-api/')) {
    pathname = pathname.replace('/admin-api', '');
    console.log('After admin-api replacement:', pathname);
  }
  
  // Ensure we have a leading slash for empty results
  if (!pathname || pathname === '') {
    pathname = '/';
  }
  
  console.log('Final routing pathname:', pathname);

  try {
    switch (pathname) {
      case '/sources':
        return await createSource(req, authHeader!);
      
      case '/enqueue':
        return await enqueueItem(req, authHeader!);
      
      case '/retry':
        return await retryQueueItem(req, authHeader!);
      
      case '/youtube-reprocess':
        return await youtubeReprocess(req, authHeader!);
      
      case '/users':
        // Distinguish between fetch and create based on request body content
        try {
          const body = await req.json().catch(() => ({}));
          if (body.email && body.display_name) {
            // Body contains user data - create user
            return await createUser(req, authHeader!, body);
          } else {
            // Body contains search parameters - fetch users
            return await getUsers(req, authHeader!, body);
          }
        } catch (error) {
          console.error('Error parsing JSON body for /users:', error);
          return await getUsers(req, authHeader!, {});
        }
        break;
      
      case '/languages':
        return await getLanguages(req, authHeader!);
      
      default:
        // Handle user detail endpoints /users/:id
        if (pathname.startsWith('/users/')) {
          const userId = pathname.split('/')[2];
          
          // Since supabase.functions.invoke always sends POST, we need to handle all operations via POST
          // and determine the action based on the request body
          try {
            const body = await req.json().catch(() => ({}));
            
            if (body.action === 'delete') {
              // Delete/deactivate user
              return await softDeleteUser(req, authHeader!, userId);
            } else if (body.action === 'get') {
              // Get user by ID
              return await getUserById(req, authHeader!, userId);
            } else if (Object.keys(body).length > 0 && !body.action) {
              // Update user (body contains user data)
              return await updateUser(req, authHeader!, userId, body);
            } else {
              // Default to get user by ID for empty body or unrecognized action
              return await getUserById(req, authHeader!, userId);
            }
          } catch (error) {
            console.error('Error parsing JSON body for user operation:', error);
            return await getUserById(req, authHeader!, userId);
          }
        }
        
        return new Response(JSON.stringify({ 
          error: 'Not found',
          pathname: pathname,
          available_endpoints: ['/sources', '/enqueue', '/retry', '/youtube-reprocess', '/users', '/languages']
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in admin-api function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});