import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchProcessResult {
  processed: number;
  sent: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Starting newsletter automation process...');
  
  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date info
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const isMonday = dayOfWeek === 1;
    
    console.log(`📅 Today is ${todayStr}, day of week: ${dayOfWeek}, isMonday: ${isMonday}`);

    // Query users eligible for newsletters
    console.log('👥 Querying eligible users...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        subscription_tier,
        language_prefs,
        display_name,
        first_name,
        newsletter_subscriptions!inner(active, cadence, slot)
      `)
      .eq('onboarding_completed', true)
      .eq('is_active', true)
      .eq('newsletter_subscriptions.active', true)
      .in('subscription_tier', ['premium', 'free']);

    if (usersError) {
      console.error('❌ Error querying users:', usersError);
      throw new Error(`Failed to query users: ${usersError.message}`);
    }

    console.log(`📊 Found ${users?.length || 0} total users with active newsletter subscriptions`);

    // Filter users based on tier and day
    const eligibleUsers = users?.filter(user => {
      const tier = user.subscription_tier;
      
      // Premium users get daily newsletters
      if (tier === 'premium') {
        return true;
      }
      
      // Free users only get newsletters on Monday
      if (tier === 'free' && isMonday) {
        return true;
      }
      
      return false;
    }) || [];

    console.log(`✅ ${eligibleUsers.length} users eligible for today's newsletters`);
    console.log(`   - Premium users: ${eligibleUsers.filter(u => u.subscription_tier === 'premium').length}`);
    console.log(`   - Free users: ${eligibleUsers.filter(u => u.subscription_tier === 'free').length}`);

    if (eligibleUsers.length === 0) {
      console.log('✨ No users eligible for newsletters today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users eligible for newsletters today',
          stats: { processed: 0, sent: 0, failed: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process users in batches of 200
    const BATCH_SIZE = 200;
    const batches = [];
    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      batches.push(eligibleUsers.slice(i, i + BATCH_SIZE));
    }

    console.log(`🔄 Processing ${eligibleUsers.length} users in ${batches.length} batch(es) of ${BATCH_SIZE}`);

    let totalStats: BatchProcessResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: []
    };

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users)...`);
      
      const batchStats = await processBatch(batch, supabase, todayStr);
      
      // Aggregate stats
      totalStats.processed += batchStats.processed;
      totalStats.sent += batchStats.sent;
      totalStats.failed += batchStats.failed;
      totalStats.errors.push(...batchStats.errors);

      console.log(`✅ Batch ${batchIndex + 1} completed: ${batchStats.sent} sent, ${batchStats.failed} failed`);
      
      // Add delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate failure rate
    const failureRate = totalStats.processed > 0 ? (totalStats.failed / totalStats.processed) * 100 : 0;
    
    console.log(`📊 Newsletter automation completed:`);
    console.log(`   - Total processed: ${totalStats.processed}`);
    console.log(`   - Sent successfully: ${totalStats.sent}`);
    console.log(`   - Failed: ${totalStats.failed}`);
    console.log(`   - Failure rate: ${failureRate.toFixed(1)}%`);

    // Alert if failure rate > 5%
    if (failureRate > 5) {
      console.error(`🚨 HIGH FAILURE RATE ALERT: ${failureRate.toFixed(1)}% failure rate`);
      // TODO: Send alert to admin (email/slack webhook)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Newsletter automation completed`,
        stats: {
          processed: totalStats.processed,
          sent: totalStats.sent,
          failed: totalStats.failed,
          failureRate: failureRate.toFixed(1) + '%'
        },
        errors: totalStats.errors.slice(0, 10) // Return first 10 errors for debugging
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Critical error in newsletter automation:', error);
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

async function processBatch(users: any[], supabase: any, todayStr: string): Promise<BatchProcessResult> {
  const result: BatchProcessResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: []
  };

  for (const user of users) {
    result.processed++;
    
    try {
      // Check for existing delivery today (idempotency)
      const dedupKey = `newsletter:${user.id}:${todayStr}`;
      
      const { data: existingDelivery, error: checkError } = await supabase
        .from('delivery_log')
        .select('id')
        .eq('dedup_key', dedupKey)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error(`❌ Error checking existing delivery for ${user.email}:`, checkError);
        result.failed++;
        result.errors.push({ userId: user.id, error: checkError.message });
        continue;
      }

      if (existingDelivery) {
        console.log(`⏭️ Newsletter already sent to ${user.email} today, skipping`);
        continue;
      }

      // Determine cadence based on tier
      const cadence = user.subscription_tier === 'premium' ? 'daily' : 'weekly';
      const slot = user.newsletter_subscriptions[0]?.slot || 'morning';

      // Send newsletter with retry logic
      const success = await sendNewsletterWithRetry(user, cadence, slot, supabase, dedupKey);
      
      if (success) {
        result.sent++;
        console.log(`✅ Newsletter sent successfully to ${user.email}`);
      } else {
        result.failed++;
        result.errors.push({ userId: user.id, error: 'All retry attempts failed' });
      }

    } catch (error) {
      result.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error processing user ${user.email}:`, errorMsg);
      result.errors.push({ userId: user.id, error: errorMsg });
    }
  }

  return result;
}

async function sendNewsletterWithRetry(
  user: any, 
  cadence: string, 
  slot: string, 
  supabase: any, 
  dedupKey: string, 
  maxRetries = 3
): Promise<boolean> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 Sending newsletter to ${user.email} (attempt ${attempt}/${maxRetries})...`);

      // Call build-digest function
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

      // Call send-email-digest function
      const sendResponse = await supabase.functions.invoke('send-email-digest', {
        body: {
          userId: user.id,
          digestContent: buildResponse.data.digestContent,
          testMode: false
        }
      });

      if (sendResponse.error) {
        throw new Error(`Send email failed: ${sendResponse.error.message}`);
      }

      if (!sendResponse.data.success) {
        throw new Error(`Send email failed: ${sendResponse.data.error}`);
      }

      // Update delivery log with dedup_key
      const { error: logError } = await supabase
        .from('delivery_log')
        .update({ dedup_key: dedupKey })
        .eq('user_id', user.id)
        .eq('channel', 'email')
        .order('sent_at', { ascending: false })
        .limit(1);

      if (logError) {
        console.error(`⚠️ Warning: Failed to update delivery log with dedup_key:`, logError);
      }

      // Track GA4 event (simplified - actual implementation would need proper analytics setup)
      console.log(`📊 GA4: newsletter_sent for ${user.subscription_tier} user`);

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
        subscription_tier: user.subscription_tier,
        cadence,
        slot,
        retry_attempts: maxRetries
      }
    });

  return false;
}