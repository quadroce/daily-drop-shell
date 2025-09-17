import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

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
    const { userId, digestContent, testMode = false }: SendEmailRequest = await req.json();
    
    console.log(`Sending email digest to user ${userId}, test mode: ${testMode}`);

    // Initialize services
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const emailFrom = Deno.env.get('EMAIL_FROM') || 'newsletter@dailydrops.ai';
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user email
    const userEmail = digestContent.user.email;
    const userName = digestContent.user.name;
    const cadence = digestContent.digest.cadence;
    const itemCount = digestContent.digest.items.length;

    // Generate email subject
    const testPrefix = testMode ? '[TEST] ' : '';
    const subject = `${testPrefix}Your ${cadence} digest - ${itemCount} new articles`;

    // Create simple HTML email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .greeting { margin: 20px 0; }
            .article { margin: 20px 0; padding: 15px; border: 1px solid #e5e5e5; border-radius: 8px; }
            .article h3 { margin: 0 0 10px 0; color: #1a1a1a; }
            .article p { margin: 5px 0; color: #666; }
            .article a { color: #2563eb; text-decoration: none; }
            .article a:hover { text-decoration: underline; }
            .tags { margin: 10px 0; }
            .tag { display: inline-block; padding: 2px 8px; margin: 2px; background: #f0f9ff; color: #0369a1; border-radius: 12px; font-size: 12px; }
            .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e5e5; margin-top: 40px; color: #666; font-size: 14px; }
            ${testMode ? '.test-banner { background: #fef3c7; color: #92400e; padding: 10px; text-align: center; margin-bottom: 20px; border-radius: 4px; }' : ''}
          </style>
        </head>
        <body>
          ${testMode ? '<div class="test-banner"><strong>TEST MODE</strong> - This is a test newsletter</div>' : ''}
          
          <div class="header">
            <div class="logo">📧 DailyDrops</div>
          </div>

          <div class="greeting">
            <h2>Hi ${userName}! 👋</h2>
            <p>Here's your ${cadence} digest with ${itemCount} new articles tailored to your interests.</p>
          </div>

          ${digestContent.digest.items.map((item: any, index: number) => `
            <div class="article">
              <h3><a href="${item.url}" target="_blank">${item.title}</a></h3>
              ${item.summary ? `<p>${item.summary}</p>` : ''}
              ${item.tags && item.tags.length > 0 ? `
                <div class="tags">
                  ${item.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('')}
                </div>
              ` : ''}
              <p><small>Published: ${new Date(item.published_at).toLocaleDateString()}</small></p>
            </div>
          `).join('')}

          <div class="footer">
            <p>You're receiving this because you're subscribed to DailyDrops newsletter.</p>
            <p><a href="#" style="color: #666;">Unsubscribe</a> | <a href="#" style="color: #666;">Update preferences</a></p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: emailFrom,
      to: [userEmail],
      subject: subject,
      html: htmlContent,
    });

    if (emailResponse.error) {
      console.error('Error sending email:', emailResponse.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log delivery
    await supabase
      .from('delivery_log')
      .insert({
        user_id: userId,
        status: 'sent',
        channel: 'email',
        provider_message_id: emailResponse.data?.id,
        meta: {
          cadence,
          item_count: itemCount,
          test_mode: testMode,
          email_sent: userEmail,
        },
      });

    console.log(`Email sent successfully to ${userEmail}, message ID: ${emailResponse.data?.id}`);

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
    console.error('Error in send-email-digest:', error);
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