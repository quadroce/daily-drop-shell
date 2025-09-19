import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { sendOnboardingReminderEmail } from '../send-onboarding-reminders/mailer.ts';

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
    console.log('🚀 Starting FORCE onboarding reminders process...');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for filters
    const body = await req.json().catch(() => ({}));
    const { userIds, skipTimingChecks = true, maxAttempts = 15 } = body;

    console.log('📋 Force send options:', { userIds, skipTimingChecks, maxAttempts });

    // Query users who need onboarding reminders
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        language_prefs,
        created_at,
        onboarding_reminders (
          attempt_count,
          last_sent_at,
          paused
        )
      `)
      .eq('onboarding_completed', false)
      .eq('is_active', true);

    // Filter by specific user IDs if provided
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query = query.in('id', userIds);
    }

    const { data: usersToRemind, error: queryError } = await query;

    if (queryError) {
      console.error('❌ Error querying users:', queryError);
      throw queryError;
    }

    console.log(`📊 Found ${usersToRemind?.length || 0} users with incomplete onboarding`);

    if (!usersToRemind || usersToRemind.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        sent: 0, 
        message: 'No users found for force reminders' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();

    const eligibleUsers: UserToRemind[] = usersToRemind
      .filter(user => {
        const reminder = user.onboarding_reminders?.[0];
        
        // Skip if paused (unless force override)
        if (reminder?.paused && !skipTimingChecks) return false;
        
        // Skip if exceeded max attempts for force send
        const attempts = reminder?.attempt_count || 0;
        if (attempts >= maxAttempts) return false;
        
        return true;
      })
      .map(user => ({
        user_id: user.id,
        email: user.email,
        first_name: user.first_name,
        preferred_lang: user.language_prefs?.[0] || 'en',
        current_attempts: user.onboarding_reminders?.[0]?.attempt_count || 0
      }));

    console.log(`✅ ${eligibleUsers.length} users eligible for FORCE reminders`);

    let successCount = 0;
    let errorCount = 0;
    const processedUsers = new Set<string>();

    for (const user of eligibleUsers) {
      if (processedUsers.has(user.user_id)) {
        console.log(`⏭️ Skipping duplicate user: ${user.user_id}`);
        continue;
      }
      
      processedUsers.add(user.user_id);

      try {
        console.log(`📧 FORCE sending reminder to: ${user.email} (attempt ${user.current_attempts + 1})`);
        
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

          // Log delivery for analytics with force marker
          const { error: deliveryError } = await supabase
            .from('delivery_log')
            .upsert({
              user_id: user.user_id,
              channel: 'email',
              status: 'sent',
              dedup_key: `onboarding_reminder_force_${user.user_id}_${user.current_attempts + 1}_${now.getTime()}`,
              sent_at: now.toISOString(),
              meta: {
                reminder_type: 'onboarding',
                attempt_number: user.current_attempts + 1,
                user_email: user.email,
                trigger: 'admin_force_send',
                force_send: true
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
            console.log(`✅ Successfully FORCE sent and recorded reminder for ${user.email}`);
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
      force_send: true,
      message: `FORCE processed ${eligibleUsers.length} users: ${successCount} sent, ${errorCount} errors`
    };

    console.log('📊 Final FORCE results:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Fatal error in FORCE onboarding reminders:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred',
        force_send: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);