import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const githubToken = Deno.env.get('GITHUB_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Record the start of sitemap generation
    const { data: runData, error: runError } = await supabase
      .from('sitemap_runs')
      .insert({
        started_at: new Date().toISOString(),
        success: false,
        total_urls: 0,
        topics_count: 0,
        archive_urls_count: 0,
        google_ping_success: false,
        bing_ping_success: false
      })
      .select()
      .single()

    if (runError) {
      console.error('Error creating sitemap run record:', runError)
      throw runError
    }

    console.log('Created sitemap run record:', runData.id)

    // Trigger GitHub Actions workflow
    const githubResponse = await fetch('https://api.github.com/repos/quadroce/daily-drop-shell/actions/workflows/generate-sitemaps.yml/dispatches', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main'
      })
    })

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text()
      console.error('GitHub API error:', errorText)
      throw new Error(`GitHub API error: ${githubResponse.status} ${errorText}`)
    }

    console.log('Successfully triggered GitHub workflow')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sitemap generation started',
        run_id: runData.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in trigger-sitemap-generation:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})