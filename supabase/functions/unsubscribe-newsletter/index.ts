import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateUnsubscribeToken, verifyUnsubscribeToken, UnsubscribeToken } from "../_shared/unsubscribe-tokens.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action'); // 'unsubscribe' or 'resubscribe'

    console.log('Unsubscribe request:', { token: token?.substring(0, 20) + '...', action });

    if (!token) {
      return new Response(
        generateErrorPage('Invalid Request', 'No unsubscribe token provided.'),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    // Verify token
    const tokenData = await verifyUnsubscribeToken(token);
    if (!tokenData) {
      return new Response(
        generateErrorPage('Invalid Token', 'The unsubscribe link is invalid or has expired.'),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isResubscribe = action === 'resubscribe';
    const newActiveStatus = !isResubscribe;

    // Update newsletter subscription
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .update({ active: newActiveStatus })
      .eq('user_id', tokenData.userId)
      .eq('cadence', tokenData.cadence)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        generateErrorPage('System Error', 'Unable to process your request. Please try again later.'),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    // Log the action
    await supabase
      .from('delivery_log')
      .insert({
        user_id: tokenData.userId,
        status: isResubscribe ? 'resubscribed' : 'unsubscribed',
        channel: 'email',
        dedup_key: `${isResubscribe ? 'resubscribe' : 'unsubscribe'}:${tokenData.userId}:${Date.now()}`,
        meta: {
          email: tokenData.email,
          cadence: tokenData.cadence,
          action: isResubscribe ? 'resubscribe' : 'unsubscribe'
        },
      });

    // Generate success page
    const successPage = generateSuccessPage(
      tokenData.email, 
      tokenData.cadence, 
      isResubscribe,
      await generateUnsubscribeToken(tokenData.userId, tokenData.email, tokenData.cadence)
    );

    return new Response(
      successPage,
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
      }
    );

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(
      generateErrorPage('System Error', 'An unexpected error occurred. Please try again later.'),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
      }
    );
  }
});

function generateSuccessPage(email: string, cadence: string, isResubscribe: boolean, oppositeToken: string): string {
  const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') || 'https://dailydrops.cloud';
  const oppositeAction = isResubscribe ? 'unsubscribe' : 'resubscribe';
  const oppositeActionText = isResubscribe ? 'Unsubscribe' : 'Resubscribe';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isResubscribe ? 'Resubscribed' : 'Unsubscribed'} - DailyDrops</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #1a1a1a; 
            margin: 0; 
            padding: 0; 
            background: #f8faff;
          }
          .container { 
            max-width: 500px; 
            margin: 80px auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #2b91f7 0%, #1d4ed8 100%);
            color: white; 
            padding: 32px 24px; 
            text-align: center; 
          }
          .content { 
            padding: 32px 24px; 
            text-align: center; 
          }
          .icon { 
            width: 64px; 
            height: 64px; 
            margin: 0 auto 24px; 
            color: ${isResubscribe ? '#10b981' : '#f59e0b'};
          }
          h1 { 
            margin: 0 0 16px; 
            font-size: 24px; 
            color: #1e293b; 
          }
          p { 
            margin: 0 0 24px; 
            color: #64748b; 
          }
          .email { 
            font-weight: 500; 
            color: #2b91f7; 
          }
          .actions { 
            display: flex; 
            gap: 12px; 
            justify-content: center; 
            flex-wrap: wrap;
          }
          .btn { 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none; 
            font-weight: 500; 
            display: inline-block;
          }
          .btn-primary { 
            background: #2b91f7; 
            color: white; 
          }
          .btn-secondary { 
            background: #f1f5f9; 
            color: #475569; 
          }
          .btn:hover { 
            opacity: 0.9; 
          }
          .footer { 
            background: #f8faff; 
            padding: 24px; 
            text-align: center; 
            font-size: 14px; 
            color: #64748b; 
          }
          @media (max-width: 480px) {
            .container { margin: 40px 16px; }
            .actions { flex-direction: column; align-items: center; }
            .btn { width: 200px; text-align: center; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DailyDrops</h1>
          </div>
          <div class="content">
            <div class="icon">
              ${isResubscribe ? 
                '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' :
                '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
              }
            </div>
            <h1>${isResubscribe ? 'Welcome back!' : 'You\'ve been unsubscribed'}</h1>
            <p>
              ${isResubscribe ? 
                `You've successfully resubscribed to our ${cadence} newsletter.` :
                `You've been unsubscribed from our ${cadence} newsletter.`
              }
            </p>
            <p class="email">${email}</p>
            <div class="actions">
              <a href="${frontendOrigin}/settings" class="btn btn-primary">Manage Preferences</a>
              <a href="?token=${oppositeToken}&action=${oppositeAction}" class="btn btn-secondary">${oppositeActionText}</a>
            </div>
          </div>
          <div class="footer">
            <p>
              <strong>DailyDrops</strong><br>
              Curated content for curious minds
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateErrorPage(title: string, message: string): string {
  const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') || 'https://dailydrops.cloud';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - DailyDrops</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #1a1a1a; 
            margin: 0; 
            padding: 0; 
            background: #f8faff;
          }
          .container { 
            max-width: 500px; 
            margin: 80px auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header { 
            background: #dc2626;
            color: white; 
            padding: 32px 24px; 
            text-align: center; 
          }
          .content { 
            padding: 32px 24px; 
            text-align: center; 
          }
          .icon { 
            width: 64px; 
            height: 64px; 
            margin: 0 auto 24px; 
            color: #dc2626;
          }
          h1 { 
            margin: 0 0 16px; 
            font-size: 24px; 
            color: #1e293b; 
          }
          p { 
            margin: 0 0 24px; 
            color: #64748b; 
          }
          .btn { 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none; 
            font-weight: 500; 
            background: #2b91f7; 
            color: white;
            display: inline-block;
          }
          .btn:hover { 
            opacity: 0.9; 
          }
          .footer { 
            background: #f8faff; 
            padding: 24px; 
            text-align: center; 
            font-size: 14px; 
            color: #64748b; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DailyDrops</h1>
          </div>
          <div class="content">
            <div class="icon">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h1>${title}</h1>
            <p>${message}</p>
            <a href="${frontendOrigin}" class="btn">Go to DailyDrops</a>
          </div>
          <div class="footer">
            <p>
              <strong>DailyDrops</strong><br>
              Curated content for curious minds
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}