import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Topic {
  id: number;
  slug: string;
  label: string;
  level: 1 | 2 | 3;
  parent_id: number | null;
}

interface Drop {
  id: number;
  title: string;
  summary: string | null;
  tags: string[];
}

interface TopicKeywords {
  topic_id: number;
  keywords: string[];
}

interface RetagResult {
  total_processed: number;
  skipped_compliant: number;
  retagged_count: number;
  errors: Array<{
    drop_id: number;
    error: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { dryRun = false, batchSize = 50 } = await req.json().catch(() => ({}));
    
    console.log(`Starting retag process: dryRun=${dryRun}, batchSize=${batchSize}`);

    // Fetch all topics and keywords
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, slug, label, level, parent_id')
      .eq('is_active', true);

    if (topicsError) {
      throw new Error(`Failed to fetch topics: ${topicsError.message}`);
    }

    const { data: topicKeywords, error: keywordsError } = await supabase
      .from('topic_keywords')
      .select('topic_id, keywords');

    if (keywordsError) {
      throw new Error(`Failed to fetch topic keywords: ${keywordsError.message}`);
    }

    // Create keyword mapping for quick lookup
    const keywordMap = new Map<number, string[]>();
    topicKeywords?.forEach(tk => {
      keywordMap.set(tk.topic_id, tk.keywords);
    });

    // Get drops that need retagging (process in batches)
    const { data: drops, error: dropsError } = await supabase
      .from('drops')
      .select('id, title, summary, tags')
      .limit(batchSize);

    if (dropsError) {
      throw new Error(`Failed to fetch drops: ${dropsError.message}`);
    }

    if (!drops || drops.length === 0) {
      return new Response(JSON.stringify({
        total_processed: 0,
        skipped_compliant: 0,
        retagged_count: 0,
        errors: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: RetagResult = {
      total_processed: drops.length,
      skipped_compliant: 0,
      retagged_count: 0,
      errors: []
    };

    for (const drop of drops) {
      try {
        console.log(`Processing drop ${drop.id}: ${drop.title}`);

        // Check if current tags are compliant
        const currentTopicIds = await getCurrentTopicIds(supabase, drop.id);
        if (await isCompliant(currentTopicIds, topics)) {
          console.log(`Drop ${drop.id} is already compliant, skipping`);
          result.skipped_compliant++;
          continue;
        }

        // Generate new compliant tags
        const newTopicIds = await generateCompliantTags(drop, topics, keywordMap);
        
        if (dryRun) {
          console.log(`DRY RUN: Would retag drop ${drop.id} with topics: ${newTopicIds}`);
          result.retagged_count++;
        } else {
          // Apply new tags using RPC
          const { error: retagError } = await supabase
            .rpc('set_article_topics', {
              _content_id: drop.id,
              _topic_ids: newTopicIds
            });

          if (retagError) {
            result.errors.push({
              drop_id: drop.id,
              error: retagError.message
            });
            console.error(`Failed to retag drop ${drop.id}: ${retagError.message}`);
          } else {
            result.retagged_count++;
            console.log(`Successfully retagged drop ${drop.id}`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({
          drop_id: drop.id,
          error: errorMsg
        });
        console.error(`Error processing drop ${drop.id}: ${errorMsg}`);
      }
    }

    console.log(`Retag process completed:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in retag-existing-content function:', error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({ 
      error: errorObj.message,
      total_processed: 0,
      skipped_compliant: 0,
      retagged_count: 0,
      errors: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getCurrentTopicIds(supabase: any, dropId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('content_topics')
    .select('topic_id')
    .eq('content_id', dropId);

  if (error) {
    console.error(`Failed to get current topics for drop ${dropId}:`, error);
    return [];
  }

  return data?.map((ct: any) => ct.topic_id) || [];
}

async function isCompliant(topicIds: number[], topics: Topic[]): Promise<boolean> {
  if (topicIds.length === 0) return false;
  if (topicIds.length > 5) return false;

  const topicLevels = topicIds.map(id => {
    const topic = topics.find(t => t.id === id);
    return topic?.level;
  }).filter(Boolean);

  const level1Count = topicLevels.filter(l => l === 1).length;
  const level2Count = topicLevels.filter(l => l === 2).length;
  const level3Count = topicLevels.filter(l => l === 3).length;

  return level1Count === 1 && level2Count === 1 && level3Count >= 1;
}

async function generateCompliantTags(
  drop: Drop, 
  topics: Topic[], 
  keywordMap: Map<number, string[]>
): Promise<number[]> {
  const text = `${drop.title} ${drop.summary || ''}`.toLowerCase();
  
  // Find best matching topics by keywords
  const level3Topics = topics.filter(t => t.level === 3);
  const level2Topics = topics.filter(t => t.level === 2);
  const level1Topics = topics.filter(t => t.level === 1);

  // Score level 3 topics by keyword matches
  const level3Scores = level3Topics.map(topic => {
    const keywords = keywordMap.get(topic.id) || [];
    const score = keywords.reduce((acc, keyword) => {
      return acc + (text.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);
    return { topic, score };
  }).sort((a, b) => b.score - a.score);

  // Try to use existing tags first, then best matches
  const existingLevel3 = level3Topics.filter(t => 
    drop.tags.some(tag => tag.toLowerCase().includes(t.slug.toLowerCase()) || t.slug.toLowerCase().includes(tag.toLowerCase()))
  );

  // Select 1-3 level 3 topics
  let selectedLevel3: Topic[] = [];
  if (existingLevel3.length > 0) {
    selectedLevel3 = existingLevel3.slice(0, 3);
  } else if (level3Scores[0]?.score > 0) {
    selectedLevel3 = level3Scores.slice(0, Math.min(3, level3Scores.filter(s => s.score > 0).length)).map(s => s.topic);
  }

  // If still no level 3 topics, use defaults
  if (selectedLevel3.length === 0) {
    const defaultLevel3 = level3Topics.find(t => t.slug === 'general-technology') || 
                          level3Topics.find(t => t.slug === 'business-general') ||
                          level3Topics[0];
    if (defaultLevel3) selectedLevel3 = [defaultLevel3];
  }

  // Find level 2 parent for selected level 3 topics
  let selectedLevel2: Topic | null = null;
  for (const l3 of selectedLevel3) {
    const parent = level2Topics.find(t => t.id === l3.parent_id);
    if (parent) {
      selectedLevel2 = parent;
      break;
    }
  }

  // If no level 2 found, use default
  if (!selectedLevel2) {
    selectedLevel2 = level2Topics.find(t => t.slug === 'technology') || 
                     level2Topics.find(t => t.slug === 'business') ||
                     level2Topics[0];
  }

  // Find level 1 parent for selected level 2
  let selectedLevel1: Topic | null = null;
  if (selectedLevel2) {
    selectedLevel1 = level1Topics.find(t => t.id === selectedLevel2.parent_id) || null;
  }

  // If no level 1 found, use default
  if (!selectedLevel1) {
    selectedLevel1 = level1Topics.find(t => t.slug === 'technology-innovation') ||
                     level1Topics.find(t => t.slug === 'business-economy') ||
                     level1Topics[0];
  }

  const result: number[] = [];
  if (selectedLevel1) result.push(selectedLevel1.id);
  if (selectedLevel2) result.push(selectedLevel2.id);
  selectedLevel3.forEach(t => result.push(t.id));

  console.log(`Generated tags for drop ${drop.id}: L1=${selectedLevel1?.slug}, L2=${selectedLevel2?.slug}, L3=[${selectedLevel3.map(t => t.slug).join(',')}]`);

  return result;
}