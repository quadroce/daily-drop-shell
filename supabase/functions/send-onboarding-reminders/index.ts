import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { sendOnboardingReminderEmail } from './mailer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserToRemind {
  user_id: string;
  email: string;
  first_name: string | null;
  preferred_lang: string;
  current_attempts: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting onboarding reminders process...');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query users who need onboarding reminders using JOIN for better reliability
    const { data: usersToRemind, error: queryError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        language_prefs,
        created_at
      `)
      .eq('onboarding_completed', false)
      .eq('is_active', true)
      .not('email', 'is', null);

    if (queryError) {
      console.error('❌ Error querying users:', queryError);
      throw queryError;
    }

    console.log(`📊 Found ${usersToRemind?.length || 0} users with incomplete onboarding`);

    if (!usersToRemind || usersToRemind.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        sent: 0, 
        message: 'No users need reminders at this time' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get reminder data separately for all users
    const userIds = usersToRemind.map(user => user.id);
    const { data: reminderData, error: reminderError } = await supabase
      .from('onboarding_reminders')
      .select('user_id, attempt_count, last_sent_at, paused')
      .in('user_id', userIds);

    if (reminderError) {
      console.error('❌ Error querying reminder data:', reminderError);
      // Continue without reminder data - treat as first attempt
      console.log('📝 Continuing without reminder data - treating as first attempts');
    }

    // Create a lookup map for reminder data
    const reminderMap = new Map();
    (reminderData || []).forEach(reminder => {
      reminderMap.set(reminder.user_id, reminder);
    });

    // Filter users who need reminders (24h first, then 30-day interval, <10 attempts, not paused)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const eligibleUsers: UserToRemind[] = usersToRemind
      .filter(user => {
        const reminder = reminderMap.get(user.id);
        const userRegistered = new Date(user.created_at);
        
        console.log(`🔍 Checking user ${user.email}:`, {
          registered: userRegistered.toISOString(),
          reminder: reminder ? {
            attempts: reminder.attempt_count,
            lastSent: reminder.last_sent_at,
            paused: reminder.paused
          } : 'no_reminder_record'
        });
        
        // Skip if paused
        if (reminder?.paused) {
          console.log(`⏸️ Skipping paused user: ${user.email}`);
          return false;
        }
        
        // Skip if already reached max attempts
        const attempts = reminder?.attempt_count || 0;
        if (attempts >= 10) {
          console.log(`🛑 Max attempts reached for user: ${user.email} (${attempts}/10)`);
          return false;
        }
        
        // First reminder: 24 hours after registration
        if (attempts === 0) {
          const eligible = userRegistered <= oneDayAgo;
          console.log(`📅 First reminder check for ${user.email}: ${eligible ? 'ELIGIBLE' : 'TOO_EARLY'} (registered ${Math.round((now.getTime() - userRegistered.getTime()) / (1000 * 60 * 60))}h ago)`);
          return eligible;
        }
        
        // Subsequent reminders: every 30 days from last sent
        if (reminder?.last_sent_at) {
          const lastSent = new Date(reminder.last_sent_at);
          const eligible = lastSent <= thirtyDaysAgo;
          console.log(`📅 Subsequent reminder check for ${user.email}: ${eligible ? 'ELIGIBLE' : 'TOO_EARLY'} (last sent ${Math.round((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24))} days ago)`);
          return eligible;
        }
        
        return true;
      })
      .map(user => {
        const reminder = reminderMap.get(user.id);
        return {
          user_id: user.id,
          email: user.email,
          first_name: user.first_name,
          preferred_lang: user.language_prefs?.[0] || 'en',
          current_attempts: reminder?.attempt_count || 0
        };
      });

    console.log(`✅ ${eligibleUsers.length} users eligible for reminders`);

    let successCount = 0;
    let errorCount = 0;
    const processedUsers = new Set<string>(); // Prevent duplicates

    for (const user of eligibleUsers) {
      // Skip if already processed (idempotency)
      if (processedUsers.has(user.user_id)) {
        console.log(`⏭️ Skipping duplicate user: ${user.user_id}`);
        continue;
      }
      
      processedUsers.add(user.user_id);

      try {
        console.log(`📧 Sending reminder to: ${user.email} (attempt ${user.current_attempts + 1})`);
        
        // Send email
        const emailResult = await sendOnboardingReminderEmail({
          email: user.email,
          firstName: user.first_name || 'there',
          preferredLang: user.preferred_lang,
          attempt: user.current_attempts + 1
        });

        if (emailResult.success) {
          // Update reminder record on successful send
          const { error: upsertError } = await supabase
            .from('onboarding_reminders')
            .upsert({
              user_id: user.user_id,
              attempt_count: user.current_attempts + 1,
              last_sent_at: now.toISOString(),
              updated_at: now.toISOString()
            });

          // Log delivery for analytics
          const { error: deliveryError } = await supabase
            .from('delivery_log')
            .upsert({
              user_id: user.user_id,
              channel: 'email',
              status: 'sent',
              dedup_key: `onboarding_reminder_${user.user_id}_${user.current_attempts + 1}_${now.getTime()}`,
              sent_at: now.toISOString(),
              meta: {
                reminder_type: 'onboarding',
                attempt_number: user.current_attempts + 1,
                user_email: user.email,
                trigger: 'automated'
              }
            }, {
              onConflict: 'dedup_key',
              ignoreDuplicates: true
            });

          if (deliveryError) {
            console.warn(`⚠️ Failed to log delivery for ${user.email}:`, deliveryError.message);
          }

          if (upsertError) {
            console.error(`❌ Failed to update reminder record for ${user.email}:`, upsertError);
            errorCount++;
          } else {
            console.log(`✅ Successfully sent and recorded reminder for ${user.email}`);
            successCount++;
          }
        } else {
          console.error(`❌ Failed to send email to ${user.email}:`, emailResult.error);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      total_eligible: eligibleUsers.length,
      sent: successCount,
      errors: errorCount,
      message: `Processed ${eligibleUsers.length} users: ${successCount} sent, ${errorCount} errors`
    };

    console.log('📊 Final results:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Fatal error in onboarding reminders:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);