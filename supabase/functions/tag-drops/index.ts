import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = "https://qimelntuxquptqqynxzv.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Topic {
  id: number;
  slug: string;
  label: string;
}

interface Drop {
  id: number;
  title: string;
  summary: string;
  url: string;
}

interface ClassificationResult {
  topics: string[];
  language: string;
}

interface ProcessResult {
  processed: number;
  tagged: number;
  errors: number;
  details: Array<{
    id: number;
    url: string;
    status: 'success' | 'error';
    topics?: string[];
    language?: string;
    error?: string;
  }>;
}

// Fetch available topics from the database
async function fetchTopics(): Promise<Topic[]> {
  console.log('Fetching topics from Supabase...');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/topics?select=id,slug,label`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to fetch topics:', errorText);
    throw new Error(`Failed to fetch topics: ${errorText}`);
  }

  const topics = await response.json();
  console.log(`Successfully fetched ${topics.length} topics`);
  return topics;
}

// Fetch drops that need tagging
async function fetchDropsToTag(limit: number): Promise<Drop[]> {
  console.log(`Fetching ${limit} drops that need tagging...`);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/drops?og_scraped=eq.true&tag_done=eq.false&select=id,title,summary,url&order=created_at.desc&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to fetch drops:', errorText);
    throw new Error(`Failed to fetch drops: ${errorText}`);
  }

  const drops = await response.json();
  console.log(`Successfully fetched ${drops.length} drops to tag`);
  return drops;
}

// Classify a drop using OpenAI
async function classifyDrop(drop: Drop, topicSlugs: string[]): Promise<ClassificationResult> {
  const systemPrompt = `You are a taxonomy classifier. Given a title and summary, pick 1–3 topics from THIS EXACT LIST ONLY: ${topicSlugs.join(', ')}. Also detect the content language (2-letter code like 'en', 'es', 'fr', etc.).

IMPORTANT TOPIC GROUPINGS - Use related tags when content fits:
- AI content should get: "ai" and possibly "datasci", "dev" if technical
- HealthTech content should get: "healthtech" and possibly "medicine", "biotech"  
- Dev content should get: "dev" and possibly related tech tags
- Business content should get multiple relevant business tags

Return JSON in this exact format:
{
  "topics": ["topic1", "topic2", "topic3"],
  "language": "en"
}

Rules:
- Topics MUST be from the provided list only
- Use 2-3 related topics when content spans multiple areas
- Language should be 2-letter ISO code
- Be comprehensive and accurate`;

  const userPrompt = `Title: ${drop.title}\n\nSummary: ${drop.summary || 'No summary available'}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano-2025-08-07', // FASTER: Use nano for classification tasks
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 150, // REDUCED: Faster response
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('OpenAI response:', data);
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response structure from OpenAI');
  }
  
  const content = data.choices[0].message.content;

  try {
    const parsed = JSON.parse(content);
    
    // Validate and sanitize the response
    let topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    
    // Filter topics to only include valid ones from our list
    topics = topics
      .filter((topic: any) => typeof topic === 'string' && topicSlugs.includes(topic))
      .slice(0, 3); // Limit to 3 topics max
    
    const language = typeof parsed.language === 'string' ? parsed.language.toLowerCase().slice(0, 2) : 'en';
    
    return {
      topics,
      language
    };
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error(`Failed to parse OpenAI response: ${content}`);
  }
}

// Update a drop with tags and language
async function updateDrop(dropId: number, topics: string[], language: string): Promise<void> {
  console.log(`Updating drop ${dropId} with topics: [${topics.join(', ')}], language: ${language}`);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/drops?id=eq.${dropId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tags: topics,
      lang_code: language,
      tag_done: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to update drop ${dropId}:`, errorText);
    throw new Error(`Failed to update drop ${dropId}: ${errorText}`);
  }
  
  console.log(`Successfully updated drop ${dropId}`);
}

// Process drops for tagging with concurrency support
async function processDropTagging(limit = 25, concurrent_requests = 1): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    tagged: 0,
    errors: 0,
    details: []
  };

  try {
    console.log(`Fetching topics and drops (concurrent_requests: ${concurrent_requests})...`);
    
    // Fetch available topics and drops in parallel
    const [topics, drops] = await Promise.all([
      fetchTopics(),
      fetchDropsToTag(limit)
    ]);

    if (topics.length === 0) {
      throw new Error('No topics found in database');
    }

    if (drops.length === 0) {
      console.log('No drops need tagging');
      return result;
    }

    const topicSlugs = topics.map(t => t.slug);
    console.log(`Found ${topics.length} topics and ${drops.length} drops to process`);
    console.log('Available topics:', topicSlugs.join(', '));

    // Process drops with controlled concurrency
    const processDrop = async (drop: Drop) => {
      try {
        console.log(`Processing drop ${drop.id}: ${drop.title}`);
        
        const classification = await classifyDrop(drop, topicSlugs);
        console.log(`Classification result for ${drop.id}:`, classification);
        
        await updateDrop(drop.id, classification.topics, classification.language);
        
        result.tagged++;
        result.details.push({
          id: drop.id,
          url: drop.url,
          status: 'success',
          topics: classification.topics,
          language: classification.language
        });
        
        console.log(`Successfully tagged drop ${drop.id} with topics: ${classification.topics.join(', ')}, language: ${classification.language}`);
        
      } catch (error) {
        console.error(`Error processing drop ${drop.id}:`, error);
        
        result.errors++;
        result.details.push({
          id: drop.id,
          url: drop.url,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      result.processed++;
    };

    // Process in batches with concurrency control
    if (concurrent_requests > 1) {
      // Process with controlled concurrency
      const batches = [];
      for (let i = 0; i < drops.length; i += concurrent_requests) {
        const batch = drops.slice(i, i + concurrent_requests);
        batches.push(batch);
      }
      
      for (const batch of batches) {
        await Promise.all(batch.map(processDrop));
        // Small delay between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } else {
      // Sequential processing (original behavior)
      for (const drop of drops) {
        await processDrop(drop);
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Processing complete: ${result.processed} processed, ${result.tagged} tagged, ${result.errors} errors`);
    return result;

  } catch (error) {
    console.error('Error in processDropTagging:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Tag-drops function started');
  console.log('OPENAI_API_KEY present:', !!OPENAI_API_KEY);
  console.log('SERVICE_ROLE_KEY present:', !!SERVICE_ROLE_KEY);

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is missing');
    return new Response(JSON.stringify({ 
      error: 'OPENAI_API_KEY not configured',
      processed: 0,
      tagged: 0,
      errors: 1,
      details: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!SERVICE_ROLE_KEY) {
    console.error('SERVICE_ROLE_KEY is missing');
    return new Response(JSON.stringify({ 
      error: 'SERVICE_ROLE_KEY not configured',
      processed: 0,
      tagged: 0,
      errors: 1,
      details: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let limit = 25; // Process 25 drops by default
    let concurrent_requests = 1; // Default sequential processing

    // Parse parameters from request body (POST) or query params (GET)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.batch_size && typeof body.batch_size === 'number' && body.batch_size > 0) {
          limit = Math.min(body.batch_size, 100); // INCREASED: Cap at 100 (was 50)
        }
        if (body.concurrent_requests && typeof body.concurrent_requests === 'number' && body.concurrent_requests > 0) {
          concurrent_requests = Math.min(body.concurrent_requests, 10); // Max 10 concurrent
        }
        // Support legacy limit parameter
        if (body.limit && typeof body.limit === 'number' && body.limit > 0) {
          limit = Math.min(body.limit, 100);
        }
      } catch (error) {
        console.log('Invalid JSON body, using default parameters');
      }
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const limitParam = url.searchParams.get('limit');
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (parsedLimit > 0) {
          limit = Math.min(parsedLimit, 100);
        }
      }
    }

    console.log(`Starting drop tagging with limit: ${limit}, concurrent_requests: ${concurrent_requests}`);
    console.log('About to call processDropTagging...');
    const result = await processDropTagging(limit, concurrent_requests);
    console.log('processDropTagging completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in tag-drops function:', error);
    return new Response(JSON.stringify({ 
      processed: 0,
      tagged: 0,
      errors: 1,
      details: [],
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
CURL EXAMPLES:

# Tag drops with default limit (25)
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/tag-drops \
  -H "Content-Type: application/json"

# Tag drops with custom limit
curl -X POST https://qimelntuxquptqqynxzv.supabase.co/functions/v1/tag-drops \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Manual trigger via GET
curl -X GET https://qimelntuxquptqqynxzv.supabase.co/functions/v1/tag-drops

# GET with limit parameter
curl -X GET "https://qimelntuxquptqqynxzv.supabase.co/functions/v1/tag-drops?limit=5"
*/