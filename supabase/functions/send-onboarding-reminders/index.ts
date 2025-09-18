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

    // Query users who need onboarding reminders
    const { data: usersToRemind, error: queryError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        language_prefs,
        onboarding_reminders (
          attempt_count,
          last_sent_at,
          paused
        )
      `)
      .eq('onboarding_completed', false)
      .eq('is_active', true);

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

    // Filter users who need reminders (15-day interval, <10 attempts, not paused)
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));

    const eligibleUsers: UserToRemind[] = usersToRemind
      .filter(user => {
        const reminder = user.onboarding_reminders?.[0];
        
        // Skip if paused
        if (reminder?.paused) return false;
        
        // Skip if already reached max attempts
        const attempts = reminder?.attempt_count || 0;
        if (attempts >= 10) return false;
        
        // Skip if sent recently (within 15 days)
        if (reminder?.last_sent_at) {
          const lastSent = new Date(reminder.last_sent_at);
          if (lastSent > fifteenDaysAgo) return false;
        }
        
        return true;
      })
      .map(user => ({
        user_id: user.id,
        email: user.email,
        first_name: user.first_name,
        preferred_lang: user.language_prefs?.[0] || 'en',
        current_attempts: user.onboarding_reminders?.[0]?.attempt_count || 0
      }));

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
        error: error.message || 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);