import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Drop {
  id: number;
  title: string;
  summary?: string;
  url: string;
}

interface Topic {
  id: number;
  slug: string;
  label: string;
  level: number;
}

interface ClassifyOut {
  l1: string;
  l2: string;
  l3: string[];
}

async function supa(path: string, options: any = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const headers = {
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${error}`);
  }
  return response.json();
}

function buildPrompt(topics: Topic[], params: { max_l3?: number } = {}) {
  const l1Topics = topics.filter(t => t.level === 1).map(t => `${t.slug}:${t.label}`).join(", ");
  const l2Topics = topics.filter(t => t.level === 2).map(t => `${t.slug}:${t.label}`).join(", ");
  const l3Topics = topics.filter(t => t.level === 3).map(t => `${t.slug}:${t.label}`).join(", ");
  const maxL3 = Math.max(1, params.max_l3 ?? 3);
  
  return `You are an expert content classifier. Analyze the article and classify it into our taxonomy.

AVAILABLE TOPICS:

Level 1 (broad categories): ${l1Topics}

Level 2 (specific areas): ${l2Topics}

Level 3 (detailed topics): ${l3Topics}

TASK: Return a JSON object with this exact structure:
{
  "l1": "<level-1-slug>",
  "l2": "<level-2-slug>", 
  "l3": ["<level-3-slug>", "<level-3-slug>"],
  "language": "<2-letter-code>"
}

CLASSIFICATION RULES:
1. Choose exactly ONE Level-1 topic that best represents the article's main domain
2. Choose exactly ONE Level-2 topic that is most relevant to the article's specific focus
3. Choose 1-${maxL3} Level-3 topics that add specific detail (only if truly relevant)
4. Use ONLY the slugs provided above (before the colon)
5. Be selective with L3 tags - only include if they add meaningful specificity
6. Consider the article's primary focus, not just keywords mentioned`;
}

async function classifyDrop(drop: Drop, topics: Topic[], params: { max_l3?: number }): Promise<ClassifyOut> {
  const system = buildPrompt(topics, params);
  const user = `TITLE: ${drop.title}\n\nSUMMARY: ${drop.summary ?? "No summary available"}`.slice(0, 8000);

  console.log(`Classifying drop ${drop.id}: ${drop.title.slice(0, 50)}...`);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-2025-04-14",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`OpenAI API error for drop ${drop.id}:`, errorText);
    throw new Error(`OpenAI API failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  console.log(`Raw OpenAI response for drop ${drop.id}:`, content);
  
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error(`JSON parse error for drop ${drop.id}:`, e, "Raw text:", content);
    throw new Error("Invalid JSON from OpenAI");
  }

  // Normalize and validate
  parsed.l1 = String(parsed.l1 || "").toLowerCase();
  parsed.l2 = String(parsed.l2 || "").toLowerCase();
  parsed.l3 = Array.isArray(parsed.l3) ? parsed.l3.map(String).map((s: string) => s.toLowerCase()) : [];
  if (parsed.language) parsed.language = String(parsed.language).slice(0, 5);
  
  console.log(`Parsed classification for drop ${drop.id}:`, parsed);
  
  return parsed as ClassifyOut;
}

function enforce121(result: ClassifyOut, topics: Topic[], params: { max_topics_per_drop?: number; max_l3?: number }): { l1TopicId: number | null; l2TopicId: number | null; l3Tags: string[] } {
  const maxL3 = params.max_l3 || 3;
  
  // Find topics by slug and level
  const candidatesL1 = topics.filter(t => t.level === 1);
  const candidatesL2 = topics.filter(t => t.level === 2);
  const candidatesL3 = topics.filter(t => t.level === 3);
  
  // Extract topics from classification result
  const l1 = candidatesL1.filter(t => result.l1 === t.slug);
  const l2 = candidatesL2.filter(t => result.l2 === t.slug);
  const l3 = candidatesL3.filter(t => result.l3?.includes(t.slug));
  
  // L1: exactly 1
  let l1Id = l1.length > 0 ? l1[0].id : null;
  if (!l1Id && candidatesL1.length > 0) {
    l1Id = candidatesL1[0].id; // fallback
  }
  
  // L2: exactly 1
  let l2Id = l2.length > 0 ? l2[0].id : null;
  if (!l2Id && candidatesL2.length > 0) {
    l2Id = candidatesL2[0].id; // fallback
  }
  
  // L3: only level 3, unique, cap - no minimum required
  let finalL3Slugs = Array.from(new Set(l3.filter(t => t.level === 3).map(t => t.slug))).slice(0, maxL3);
  
  // Don't force L3 tags if none are appropriate

  return {
    l1TopicId: l1Id,
    l2TopicId: l2Id,
    l3Tags: finalL3Slugs 
  };
}

async function setDropTags(dropId: number, l1TopicId: number | null, l2TopicId: number | null, l3Tags: string[], language?: string) {
  const tagDone = l1TopicId !== null && l2TopicId !== null && l3Tags.length <= 3;
  
  await supa(`/rest/v1/drops?id=eq.${dropId}`, {
    method: "PATCH",
    body: JSON.stringify({ 
      l1_topic_id: l1TopicId,
      l2_topic_id: l2TopicId,
      tags: l3Tags,
      tag_done: tagDone,
      lang_code: language
    })
  });

  // Update content_topics junction table
  if (l1TopicId || l2TopicId || l3Tags.length > 0) {
    // Delete existing relations
    await supa(`/rest/v1/content_topics?content_id=eq.${dropId}`, {
      method: "DELETE"
    });

    // Insert new relations
    const topicInserts = [];
    if (l1TopicId) topicInserts.push({ content_id: dropId, topic_id: l1TopicId });
    if (l2TopicId) topicInserts.push({ content_id: dropId, topic_id: l2TopicId });
    
    // Insert L3 topics
    if (l3Tags.length > 0) {
      const l3Topics = await supa(`/rest/v1/topics?slug=in.(${l3Tags.join(",")})&level=eq.3&select=id,slug`);
      for (const topic of l3Topics) {
        topicInserts.push({ content_id: dropId, topic_id: topic.id });
      }
    }

    if (topicInserts.length > 0) {
      await supa("/rest/v1/content_topics", {
        method: "POST",
        body: JSON.stringify(topicInserts)
      });
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting retroactive tagging process...");

    // Get all topics
    const topics: Topic[] = await supa("/rest/v1/topics?select=id,slug,label,level&is_active=eq.true&order=level,label");
    console.log(`Loaded ${topics.length} topics`);
    
    if (topics.length === 0) {
      throw new Error("No topics found");
    }

    const topicSlugs = topics.map(t => t.slug);

    // Get untagged drops in batches
    const batchSize = 10;
    let offset = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    const results = [];

    while (true) {
      const drops: Drop[] = await supa(
        `/rest/v1/drops?tag_done=eq.false&select=id,title,summary,url&order=id&limit=${batchSize}&offset=${offset}`
      );

      if (drops.length === 0) {
        console.log("No more drops to process");
        break;
      }

      console.log(`Processing batch ${Math.floor(offset/batchSize) + 1}: ${drops.length} drops`);

      for (const drop of drops) {
        try {
          console.log(`Tagging drop ${drop.id}: "${drop.title.slice(0, 50)}..."`);
          
          // Classify using OpenAI
          const classification = await classifyDrop(drop, topics, { max_l3: 3 });
          console.log(`Classification result for ${drop.id}:`, classification);
          
          // Enforce constraints
          const enforced = enforce121(classification, topics, { max_l3: 3 });
          console.log(`Enforced result for ${drop.id}:`, enforced);
          
          // Update database
          await setDropTags(drop.id, enforced.l1TopicId, enforced.l2TopicId, enforced.l3Tags);
          
          results.push({
            dropId: drop.id,
            title: drop.title.slice(0, 100),
            status: "success",
            l1TopicId: enforced.l1TopicId,
            l2TopicId: enforced.l2TopicId,
            l3Tags: enforced.l3Tags
          });

          totalProcessed++;
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing drop ${drop.id}:`, error);
          totalErrors++;
          
          const errorObj = error instanceof Error ? error : new Error(String(error));
          results.push({
            dropId: drop.id,
            title: drop.title.slice(0, 100),
            status: "error",
            error: errorObj.message
          });
        }
      }

      offset += batchSize;
    }

    console.log(`Retroactive tagging completed. Processed: ${totalProcessed}, Errors: ${totalErrors}`);

    return new Response(JSON.stringify({
      success: true,
      totalProcessed,
      totalErrors,
      results: results.slice(-20) // Return last 20 results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Retroactive tagging failed:", error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      success: false,
      error: errorObj.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});