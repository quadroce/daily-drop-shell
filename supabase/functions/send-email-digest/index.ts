import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { renderTemplate } from "../_shared/email-template.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe-tokens.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  userId: string;
  digestContent: any;
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
    console.log('=== DETAILED LOGGING START ===');
    console.log('1. Request headers:', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
    
    const rawBody = await req.text();
    console.log('2. Raw request body:', rawBody);
    
    const parsedBody = JSON.parse(rawBody);
    console.log('3. Parsed request body:', JSON.stringify(parsedBody, null, 2));
    
    const { userId, digestContent, testMode = false }: SendEmailRequest = parsedBody;
    
    console.log('4. Extracted parameters:');
    console.log(`   - userId: ${userId}`);
    console.log(`   - testMode: ${testMode}`);
    console.log(`   - digestContent type: ${typeof digestContent}`);
    console.log(`   - digestContent keys: ${digestContent ? Object.keys(digestContent) : 'null'}`);

    // Initialize services
    console.log('5. Checking environment variables:');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailFrom = Deno.env.get('EMAIL_FROM') || 'Daily Drops <dailydrop@newsletter.dailydrops.cloud>';
    
    console.log(`   - RESEND_API_KEY present: ${!!resendApiKey}`);
    console.log(`   - RESEND_API_KEY length: ${resendApiKey?.length || 0}`);
    console.log(`   - EMAIL_FROM: ${emailFrom}`);
    console.log(`   - SUPABASE_URL present: ${!!Deno.env.get('SUPABASE_URL')}`);
    console.log(`   - SUPABASE_SERVICE_ROLE_KEY present: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`);
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('6. Initializing Resend client...');
    const resend = new Resend(resendApiKey);
    console.log('   - Resend client created successfully');
    
    console.log('7. Initializing Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('   - Supabase client created successfully');

    console.log('8. Extracting user and digest data:');
    // Get user email
    const userEmail = digestContent.user.email;
    const userName = digestContent.user.name;
    const cadence = digestContent.digest.cadence;
    const itemCount = digestContent.digest.items.length;
    
    console.log(`   - userEmail: ${userEmail}`);
    console.log(`   - userName: ${userName}`);
    console.log(`   - cadence: ${cadence}`);
    console.log(`   - itemCount: ${itemCount}`);
    console.log(`   - digestContent.digest.items structure:`, JSON.stringify(digestContent.digest.items.slice(0, 1), null, 2));

    console.log('9. Generating email subject and content...');
    // Generate email subject
    const testPrefix = testMode ? '[TEST] ' : '';
    const subject = `${testPrefix}Your ${cadence} digest - ${itemCount} new articles`;
    console.log(`   - Generated subject: ${subject}`);

    console.log('10. Creating HTML email content using shared template...');
    console.log(`    - Processing ${itemCount} items for HTML generation`);
    
    // Generate unsubscribe token
    const unsubscribeToken = await generateUnsubscribeToken(userId, userEmail, cadence);
    const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') || 'https://dailydrops.cloud';
    const unsubscribeUrl = `https://qimelntuxquptqqynxzv.supabase.co/functions/v1/unsubscribe-newsletter?token=${unsubscribeToken}`;
    const preferencesUrl = `${frontendOrigin}/settings`;
    
    // Add unsubscribe URLs to digest content
    const digestWithUnsubscribe = {
      ...digestContent,
      unsubscribeUrl,
      preferencesUrl
    };
    
    // Use the shared email template
    const htmlContent = renderTemplate(digestWithUnsubscribe);
    
    console.log(`    - HTML content length: ${htmlContent.length} characters`);
    console.log('    - HTML content preview (first 200 chars):', htmlContent.substring(0, 200));

    console.log('11. Preparing email payload for Resend...');
    const emailPayload = {
      from: emailFrom,
      to: [userEmail],
      subject: subject,
      html: htmlContent,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    };
    console.log('    - Email payload prepared:');
    console.log(`      - from: ${emailPayload.from}`);
    console.log(`      - to: ${JSON.stringify(emailPayload.to)}`);
    console.log(`      - subject: ${emailPayload.subject}`);
    console.log(`      - html length: ${emailPayload.html.length}`);

    console.log('12. Sending email via Resend...');
    console.log('    - About to call resend.emails.send()');
    
    // Send email
    const emailResponse = await resend.emails.send(emailPayload);
    
    console.log('13. Resend response received:');
    console.log('    - Full response:', JSON.stringify(emailResponse, null, 2));

    if (emailResponse.error) {
      console.error('14. ERROR: Resend returned an error:');
      console.error('    - Error object:', JSON.stringify(emailResponse.error, null, 2));
      console.error('    - Error type:', typeof emailResponse.error);
      console.error('    - Error message:', emailResponse.error.message || 'No message');
      console.error('    - Error name:', emailResponse.error.name || 'No name');
      console.error('    - Full error details:', emailResponse.error);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email', details: emailResponse.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('15. Email sent successfully! Processing database logging...');
    console.log(`    - Message ID: ${emailResponse.data?.id}`);
    console.log(`    - Email data:`, JSON.stringify(emailResponse.data, null, 2));

    console.log('16. Inserting delivery log into database...');
    // Log delivery with dedup_key for idempotency
    const deliveryLogPayload = {
      user_id: userId,
      status: 'sent',
      channel: 'email',
      provider_message_id: emailResponse.data?.id,
      dedup_key: `email:${userId}:${new Date().toISOString().split('T')[0]}`,
      meta: {
        cadence,
        item_count: itemCount,
        test_mode: testMode,
        email_sent: userEmail,
        drop_ids: digestContent.dropIds || [] // Track which specific drops were sent for debugging/analytics
      },
    };
    console.log('    - Delivery log payload:', JSON.stringify(deliveryLogPayload, null, 2));

    // Log delivery with UPSERT to handle duplicates gracefully
    const { data: logData, error: logError } = await supabase
      .from('delivery_log')
      .upsert(deliveryLogPayload, {
        onConflict: 'dedup_key',
        ignoreDuplicates: false
      })
      .select();
      
    if (logError) {
      console.error('17. ERROR: Failed to upsert delivery log:');
      console.error('    - Log error:', JSON.stringify(logError, null, 2));
      console.error('    - But email was sent successfully, continuing...');
    } else {
      console.log('17. Delivery log upserted successfully:', JSON.stringify(logData, null, 2));
    }

    console.log(`18. SUCCESS: Email sent successfully to ${userEmail}, message ID: ${emailResponse.data?.id}`);
    console.log('=== DETAILED LOGGING END ===');

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResponse.data?.id,
        emailSent: userEmail,
        itemCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('=== ERROR IN SEND-EMAIL-DIGEST ===');
    console.error('CRITICAL ERROR occurred during email digest sending:');
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    console.error('Timestamp:', new Date().toISOString());
    console.error('=== END ERROR DETAILS ===');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.name : typeof error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});