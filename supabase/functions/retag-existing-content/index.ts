import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

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
  summary: string;
  tags: string[];
}

interface TopicKeywords {
  topic_id: number;
  keywords: string[];
}

interface RetagRequest {
  dryRun?: boolean;
  batchSize?: number;
  contentIds?: number[];
}

interface RetagResult {
  processed: number;
  compliant: number;
  retagged: number;
  errors: number;
  dryRun: boolean;
  details: Array<{
    contentId: number;
    action: 'skip' | 'retag' | 'error';
    oldTags?: string[];
    newTopicIds?: number[];
    reason?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase configuration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const body: RetagRequest = req.method === 'POST' ? await req.json() : {};
    const { dryRun = false, batchSize = 100, contentIds } = body;

    console.log(`Starting retag process - dryRun: ${dryRun}, batchSize: ${batchSize}`);

    // Fetch all topics and keywords
    const [topicsResult, keywordsResult] = await Promise.all([
      supabase.from('topics').select('id, slug, label, level, parent_id').order('level'),
      supabase.from('topic_keywords').select('topic_id, keywords')
    ]);

    if (topicsResult.error) {
      throw new Error(`Failed to fetch topics: ${topicsResult.error.message}`);
    }

    if (keywordsResult.error) {
      console.warn('Failed to fetch keywords, proceeding without:', keywordsResult.error.message);
    }

    const topics: Topic[] = topicsResult.data;
    const keywords: TopicKeywords[] = keywordsResult.data || [];
    const keywordMap = new Map(keywords.map(k => [k.topic_id, k.keywords]));

    // Group topics by level
    const level1Topics = topics.filter(t => t.level === 1);
    const level2Topics = topics.filter(t => t.level === 2);
    const level3Topics = topics.filter(t => t.level === 3);

    // Default fallback topics (first available in each level)
    const defaultLevel1 = level1Topics[0];
    const defaultLevel2 = level2Topics.find(t => t.parent_id === defaultLevel1?.id) || level2Topics[0];
    const defaultLevel3 = level3Topics.find(t => t.parent_id === defaultLevel2?.id) || level3Topics[0];

    if (!defaultLevel1 || !defaultLevel2 || !defaultLevel3) {
      throw new Error('Database must have at least one topic at each level (1, 2, 3)');
    }

    console.log(`Loaded ${topics.length} topics (L1: ${level1Topics.length}, L2: ${level2Topics.length}, L3: ${level3Topics.length})`);

    // Fetch content to retag
    let query = supabase
      .from('drops')
      .select('id, title, summary, tags')
      .limit(batchSize);

    if (contentIds && contentIds.length > 0) {
      query = query.in('id', contentIds);
    }

    const { data: drops, error: dropsError } = await query;

    if (dropsError) {
      throw new Error(`Failed to fetch drops: ${dropsError.message}`);
    }

    console.log(`Processing ${drops?.length || 0} drops`);

    const result: RetagResult = {
      processed: 0,
      compliant: 0,
      retagged: 0,
      errors: 0,
      dryRun,
      details: []
    };

    for (const drop of drops || []) {
      result.processed++;

      try {
        // Check if content is already compliant
        const currentTopicIds = await getCurrentTopicIds(supabase, drop.id);
        const compliance = checkCompliance(currentTopicIds, topics);

        if (compliance.isCompliant) {
          result.compliant++;
          result.details.push({
            contentId: drop.id,
            action: 'skip',
            reason: 'Already compliant'
          });
          continue;
        }

        // Generate new topic assignments
        const newTopicIds = await generateTopicAssignment(
          drop, 
          topics, 
          level1Topics, 
          level2Topics, 
          level3Topics,
          keywordMap,
          defaultLevel1,
          defaultLevel2,
          defaultLevel3
        );

        if (!dryRun) {
          // Apply the new tagging using our RPC
          const { error: rpcError } = await supabase.rpc('set_article_topics', {
            _content_id: drop.id,
            _topic_ids: newTopicIds
          });

          if (rpcError) {
            throw new Error(`RPC error: ${rpcError.message}`);
          }
        }

        result.retagged++;
        result.details.push({
          contentId: drop.id,
          action: 'retag',
          oldTags: drop.tags,
          newTopicIds,
          reason: `Non-compliant: ${compliance.issues.join(', ')}`
        });

      } catch (error) {
        result.errors++;
        result.details.push({
          contentId: drop.id,
          action: 'error',
          reason: error.message
        });
        console.error(`Error processing drop ${drop.id}:`, error);
      }
    }

    console.log(`Retag process complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Retag process failed:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processed: 0,
        compliant: 0,
        retagged: 0,
        errors: 1,
        dryRun: false,
        details: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getCurrentTopicIds(supabase: any, contentId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('content_topics')
    .select('topic_id')
    .eq('content_id', contentId);

  if (error) {
    console.warn(`Failed to get current topics for ${contentId}:`, error);
    return [];
  }

  return (data || []).map((row: any) => row.topic_id);
}

function checkCompliance(topicIds: number[], allTopics: Topic[]): { isCompliant: boolean; issues: string[] } {
  const issues: string[] = [];
  const topicLevels = topicIds.map(id => allTopics.find(t => t.id === id)?.level).filter(Boolean);

  const level1Count = topicLevels.filter(l => l === 1).length;
  const level2Count = topicLevels.filter(l => l === 2).length;
  const level3Count = topicLevels.filter(l => l === 3).length;

  if (topicIds.length > 5) issues.push('More than 5 topics');
  if (level1Count !== 1) issues.push(`Need exactly 1 L1 topic, got ${level1Count}`);
  if (level2Count !== 1) issues.push(`Need exactly 1 L2 topic, got ${level2Count}`);
  if (level3Count < 1) issues.push(`Need at least 1 L3 topic, got ${level3Count}`);

  return { isCompliant: issues.length === 0, issues };
}

async function generateTopicAssignment(
  drop: Drop,
  allTopics: Topic[],
  level1Topics: Topic[],
  level2Topics: Topic[],
  level3Topics: Topic[],
  keywordMap: Map<number, string[]>,
  defaultLevel1: Topic,
  defaultLevel2: Topic,
  defaultLevel3: Topic
): Promise<number[]> {
  
  const content = `${drop.title} ${drop.summary || ''}`.toLowerCase();
  
  // Try to match existing tags first (prefer existing valid topics)
  const existingValidTopics = drop.tags
    .map(tag => allTopics.find(t => t.slug === tag))
    .filter((t): t is Topic => t !== undefined);

  let selectedLevel1 = existingValidTopics.find(t => t.level === 1) || null;
  let selectedLevel2 = existingValidTopics.find(t => t.level === 2) || null;
  let selectedLevel3Topics = existingValidTopics.filter(t => t.level === 3);

  // Use keyword matching for missing levels
  if (!selectedLevel1) {
    selectedLevel1 = findTopicByKeywords(content, level1Topics, keywordMap) || defaultLevel1;
  }

  if (!selectedLevel2) {
    // Try to find L2 under the selected L1, or use keywords
    const candidatesUnderL1 = level2Topics.filter(t => t.parent_id === selectedLevel1.id);
    selectedLevel2 = findTopicByKeywords(content, candidatesUnderL1, keywordMap) ||
                    candidatesUnderL1[0] ||
                    findTopicByKeywords(content, level2Topics, keywordMap) ||
                    defaultLevel2;
  }

  if (selectedLevel3Topics.length === 0) {
    // Try to find L3 under the selected L2, or use keywords
    const candidatesUnderL2 = level3Topics.filter(t => t.parent_id === selectedLevel2.id);
    const keywordMatch = findTopicByKeywords(content, candidatesUnderL2, keywordMap) ||
                        candidatesUnderL2[0] ||
                        findTopicByKeywords(content, level3Topics, keywordMap) ||
                        defaultLevel3;
    selectedLevel3Topics = [keywordMatch];
  }

  // Ensure we don't exceed 5 topics total and have at most 3 L3 topics
  selectedLevel3Topics = selectedLevel3Topics.slice(0, Math.min(3, 5 - 2)); // 5 total - L1 - L2 = max 3 L3

  return [selectedLevel1.id, selectedLevel2.id, ...selectedLevel3Topics.map(t => t.id)];
}

function findTopicByKeywords(content: string, candidates: Topic[], keywordMap: Map<number, string[]>): Topic | null {
  let bestMatch: Topic | null = null;
  let highestScore = 0;

  for (const topic of candidates) {
    const keywords = keywordMap.get(topic.id) || [];
    const score = keywords.reduce((sum, keyword) => {
      return sum + (content.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = topic;
    }
  }

  return bestMatch;
}