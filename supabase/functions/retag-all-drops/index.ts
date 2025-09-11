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

function buildPrompt(topicSlugs: string[], params: { max_l3?: number } = {}) {
  const maxL3 = params.max_l3 || 3;
  const list = topicSlugs.join(", ");
  
  return `You are a content tagger for a tech/business news aggregator.
Given an article title and summary, classify it using the available topic taxonomy.

Rules:
- Allowed slugs are ONLY from this list: [${list}]
- Exactly 1 for l1, exactly 1 for l2, and 0..${maxL3} for l3 (all distinct).
- l1 must be a Level-1 topic, l2 Level-2, l3 Level-3.
- L3 tags are OPTIONAL - only include them if they are truly relevant to the content.
- Choose the most specific and relevant L3 tags for the content.
- Prefer concise and accurate mapping.
If you cannot satisfy the constraints, pick the closest valid slugs.`;
}

async function classifyDrop(drop: Drop, topicSlugs: string[], params: { max_l3?: number }): Promise<ClassifyOut> {
  const system = buildPrompt(topicSlugs, params);
  const user = `${drop.title}\n\n${drop.summary ?? ""}`.slice(0, 8000);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_completion_tokens: 150,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse OpenAI response:", content);
    throw new Error("Invalid JSON from OpenAI");
  }
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
          const classification = await classifyDrop(drop, topicSlugs, { max_l3: 3 });
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
          
          results.push({
            dropId: drop.id,
            title: drop.title.slice(0, 100),
            status: "error",
            error: error.message
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
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});