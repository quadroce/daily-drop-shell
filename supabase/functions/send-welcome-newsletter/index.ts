import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeNewsletterRequest {
  userId: string;
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

  console.log('🎉 Starting welcome newsletter send...');

  try {
    const { userId }: WelcomeNewsletterRequest = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`👋 Processing welcome newsletter for user ${userId}`);

    // Get user info and verify they're eligible
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        subscription_tier,
        language_prefs,
        display_name,
        first_name,
        onboarding_completed,
        is_active,
        newsletter_subscriptions!inner(active, cadence, slot)
      `)
      .eq('id', userId)
      .eq('onboarding_completed', true)
      .eq('is_active', true)
      .eq('newsletter_subscriptions.active', true)
      .single();

    if (userError || !user) {
      console.error('❌ User not found or not eligible:', userError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not found or not eligible for newsletter' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is Free tier (Premium gets daily, so no need for welcome email)
    if (user.subscription_tier !== 'free') {
      console.log(`⏭️ User ${user.email} is ${user.subscription_tier} tier, not sending welcome newsletter`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Welcome newsletter is only for free tier users' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we already sent a welcome newsletter today
    const todayStr = new Date().toISOString().split('T')[0];
    const dedupKey = `newsletter:${userId}:${todayStr}`;

    const { data: existingDelivery, error: checkError } = await supabase
      .from('delivery_log')
      .select('id')
      .eq('dedup_key', dedupKey)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error checking existing delivery:', checkError);
      throw new Error(`Failed to check existing delivery: ${checkError.message}`);
    }

    if (existingDelivery) {
      console.log(`⏭️ Newsletter already sent to ${user.email} today`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Newsletter already sent today' 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send welcome newsletter
    const success = await sendWelcomeNewsletter(user, supabase, dedupKey);

    if (success) {
      console.log(`✅ Welcome newsletter sent successfully to ${user.email}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Welcome newsletter sent to ${user.email}`,
          userId: user.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Failed to send welcome newsletter after retries');
    }

  } catch (error) {
    console.error('💥 Error in welcome newsletter:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendWelcomeNewsletter(
  user: any, 
  supabase: any, 
  dedupKey: string,
  maxRetries = 3
): Promise<boolean> {
  let lastError: Error | null = null;

  const cadence = 'weekly'; // Free users get weekly
  const slot = user.newsletter_subscriptions[0]?.slot || 'morning';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 Sending welcome newsletter to ${user.email} (attempt ${attempt}/${maxRetries})...`);

      // Call build-digest function to get personalized content
      const buildResponse = await supabase.functions.invoke('build-digest', {
        body: {
          userId: user.id,
          cadence,
          slot,
          testMode: false
        }
      });

      if (buildResponse.error) {
        throw new Error(`Build digest failed: ${buildResponse.error.message}`);
      }

      if (!buildResponse.data.success) {
        throw new Error(`Build digest failed: ${buildResponse.data.error}`);
      }

      // Customize the digest content for welcome email
      const welcomeDigestContent = {
        ...buildResponse.data.digestContent,
        isWelcomeEmail: true,
        digest: {
          ...buildResponse.data.digestContent.digest,
          welcomeMessage: `Welcome to Daily Drops! Here's a personalized selection of content to get you started.`
        }
      };

      // Call send-email-digest function
      const sendResponse = await supabase.functions.invoke('send-email-digest', {
        body: {
          userId: user.id,
          digestContent: welcomeDigestContent,
          testMode: false
        }
      });

      if (sendResponse.error) {
        throw new Error(`Send email failed: ${sendResponse.error.message}`);
      }

      if (!sendResponse.data.success) {
        throw new Error(`Send email failed: ${sendResponse.data.error}`);
      }

      // Update delivery log with dedup_key and welcome flag
      const { error: logError } = await supabase
        .from('delivery_log')
        .update({ 
          dedup_key: dedupKey,
          meta: {
            ...sendResponse.data.meta,
            is_welcome_email: true,
            subscription_tier: user.subscription_tier,
            cadence,
            slot
          }
        })
        .eq('user_id', user.id)
        .eq('channel', 'email')
        .order('sent_at', { ascending: false })
        .limit(1);

      if (logError) {
        console.error(`⚠️ Warning: Failed to update delivery log:`, logError);
      }

      // Track GA4 event for welcome newsletter
      console.log(`📊 GA4: newsletter_sent (welcome) for ${user.subscription_tier} user`);

      return true;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Attempt ${attempt} failed for ${user.email}:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 2^attempt seconds
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // Log final failure
  await supabase
    .from('delivery_log')
    .insert({
      user_id: user.id,
      channel: 'newsletter',
      status: 'error',
      error_msg: lastError?.message || 'All retry attempts failed',
      sent_at: new Date().toISOString(),
      dedup_key: dedupKey,
      meta: {
        is_welcome_email: true,
        subscription_tier: user.subscription_tier,
        cadence,
        slot,
        retry_attempts: maxRetries
      }
    });

  return false;
}