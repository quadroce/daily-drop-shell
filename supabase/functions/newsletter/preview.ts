// Newsletter preview endpoint
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildNewsletterPayload } from './payload.ts';
import { renderNewsletterTemplate } from './template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }
  
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const cadence = url.searchParams.get('cadence') as 'daily' | 'weekly' | 'monthly' || 'daily';
    const slot = url.searchParams.get('slot') as 'morning' | 'afternoon' | 'evening' || 'morning';
    const format = url.searchParams.get('format') || 'html'; // html or json
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📧 Newsletter preview requested - userId: ${userId}, cadence: ${cadence}, slot: ${slot}`);
    
    // Build the payload using the same logic as production
    const payload = await buildNewsletterPayload(userId, cadence, slot, {
      maxItems: 5,
      useCacheOnly: false, // Always allow fallback for preview
    });
    
    if (format === 'json') {
      // Return JSON payload for debugging
      return new Response(
        JSON.stringify(payload, null, 2),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Add preview URLs (mock for preview)
    const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') || 'https://dailydrops.cloud';
    const payloadWithUrls = {
      ...payload,
      testMode: true,
      unsubscribeUrl: `${frontendOrigin}/unsubscribe?preview=true`,
      preferencesUrl: `${frontendOrigin}/settings`,
    };
    
    // Render HTML template
    const htmlContent = renderNewsletterTemplate(payloadWithUrls);
    
    return new Response(htmlContent, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error in newsletter preview:', error);
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Newsletter Preview Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
            .details { margin-top: 10px; font-family: monospace; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>Newsletter Preview Error</h2>
            <p>Failed to generate newsletter preview.</p>
            <div class="details">
              Error: ${error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </div>
        </body>
      </html>
    `;
    
    return new Response(errorHtml, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
});