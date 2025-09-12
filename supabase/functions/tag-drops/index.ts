import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ===== Config =====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://YOUR-PROJECT.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!SERVICE_ROLE_KEY) console.warn("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!OPENAI_API_KEY) console.warn("Missing OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Topic = { id: number; slug: string; label: string; level: number };
type Drop  = { id: number; title: string; summary: string | null; language: string | null };

type ClassifyOut = { l1: string; l2: string; l3: string[]; language?: string };

// ===== Utilities =====
function jres(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function supa(path: string, init: RequestInit = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase error ${res.status}: ${t}`);
  }
  return res;
}

// ===== Fetch topics & drops =====
async function fetchTopics(): Promise<Topic[]> {
  const res = await supa(`/rest/v1/topics?select=id,slug,label,level&order=level.asc,slug.asc`);
  return await res.json();
}

async function fetchDrops(limit: number, options: { drop_ids?: number[], force_retag?: boolean } = {}): Promise<Drop[]> {
  const { drop_ids, force_retag } = options;
  
  let query = `/rest/v1/drops?select=id,title,summary,language`;
  
  if (drop_ids && drop_ids.length > 0) {
    // Se sono specificati drop_ids, cercare solo quelli
    const idsFilter = drop_ids.map(id => `eq.${id}`).join(',');
    query += `&id=in.(${drop_ids.join(',')})`;
  } else {
    // Altrimenti usa la logica normale con limite
    if (!force_retag) {
      query += `&tag_done=is.false`;
    }
    query += `&order=created_at.desc&limit=${limit}`;
  }
  
  console.log('Executing query:', query);
  const res = await supa(query);
  return await res.json();
}

// ===== LLM classification =====
function buildPrompt(topics: Topic[], params: { max_l3?: number }) {
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
6. Consider the article's primary focus, not just keywords mentioned

Examples:
- AI research article → "technology", "ai", ["machine-learning", "research"]
- Startup funding news → "business", "startups", ["funding", "venture-capital"]
- UX design tutorial → "design", "ux", ["user-research", "prototyping"]`;
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
    }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`OpenAI API error for drop ${drop.id}:`, errorText);
    throw new Error(`OpenAI ${res.status} ${errorText}`);
  }
  
  const out = await res.json();
  const txt = out.choices?.[0]?.message?.content ?? "{}";
  
  console.log(`Raw OpenAI response for drop ${drop.id}:`, txt);
  
  let parsed: any;
  try { 
    parsed = JSON.parse(txt); 
  } catch (e) {
    console.error(`JSON parse error for drop ${drop.id}:`, e, "Raw text:", txt);
    parsed = { l1: "", l2: "", l3: [] };
  }
  
  // Normalize and validate
  parsed.l1 = String(parsed.l1 || "").toLowerCase();
  parsed.l2 = String(parsed.l2 || "").toLowerCase();
  parsed.l3 = Array.isArray(parsed.l3) ? parsed.l3.map(String).map(s => s.toLowerCase()) : [];
  if (parsed.language) parsed.language = String(parsed.language).slice(0, 5);
  
  console.log(`Parsed classification for drop ${drop.id}:`, parsed);
  
  return parsed as ClassifyOut;
}

// ===== Post-processing / enforcement =====
function byLevelMap(topics: Topic[]) {
  const bySlug = new Map<string, Topic>(topics.map(t => [t.slug, t]));
  return { bySlug };
}

function enforce121(result: ClassifyOut, topics: Topic[], params: {max_topics_per_drop?: number; max_l3?: number}) {
  const { bySlug } = byLevelMap(topics);
  const maxL3 = Math.max(1, params.max_l3 ?? 3); // Ensure at least 1 L3 tag

  const l1 = bySlug.get(result.l1);
  const l2 = bySlug.get(result.l2);
  const l3 = (result.l3 || []).map(s => bySlug.get(s)).filter(Boolean) as Topic[];

  // Pick-first fallback if wrong level/missing
  const pickOne = (arr: Topic[], level: number) => (arr.find(t => t.level === level) ?? arr[0]);

  const candidatesL1 = topics.filter(t => t.level === 1);
  const candidatesL2 = topics.filter(t => t.level === 2);
  const candidatesL3 = topics.filter(t => t.level === 3);

  const finalL1Topic = l1?.level === 1 ? l1 : pickOne(candidatesL1, 1);
  const finalL2Topic = l2?.level === 2 ? l2 : pickOne(candidatesL2, 2);

  // L3: only level 3, unique, cap - no minimum required
  let finalL3Slugs = Array.from(new Set(l3.filter(t => t.level === 3).map(t => t.slug))).slice(0, maxL3);
  
  // Don't force L3 tags if none are appropriate

  return { 
    l1TopicId: finalL1Topic?.id ?? null, 
    l2TopicId: finalL2Topic?.id ?? null, 
    l3Tags: finalL3Slugs 
  };
}

// ===== Write topics using new structure =====
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
    }),
  });
  
  // Update content_topics junction table
  if (tagDone) {
    // Delete existing topics
    await supa(`/rest/v1/content_topics?content_id=eq.${dropId}`, {
      method: "DELETE"
    });
    
    // Insert new topics
    const topicInserts = [];
    if (l1TopicId) topicInserts.push({ content_id: dropId, topic_id: l1TopicId });
    if (l2TopicId) topicInserts.push({ content_id: dropId, topic_id: l2TopicId });
    
    // Add L3 topics
    for (const l3Tag of l3Tags) {
      const l3TopicRes = await supa(`/rest/v1/topics?slug=eq.${l3Tag}&level=eq.3&select=id`);
      const l3Topics = await l3TopicRes.json();
      if (l3Topics.length > 0) {
        topicInserts.push({ content_id: dropId, topic_id: l3Topics[0].id });
      }
    }
    
    if (topicInserts.length > 0) {
      await supa(`/rest/v1/content_topics`, {
        method: "POST",
        body: JSON.stringify(topicInserts),
      });
    }
  }
}

// ===== Handler =====
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Number(limitParam ?? body.limit ?? 25);
    const max_l3 = Number(body.max_l3 ?? 3);
    
    // Supporto per force_retag e drop_ids specifici
    const drop_ids = body.drop_ids;
    const force_retag = body.force_retag;
    
    console.log('Request parameters:', { limit, max_l3, drop_ids, force_retag });

    // Load config
    const [topics, drops] = await Promise.all([
      fetchTopics(), 
      fetchDrops(limit, { drop_ids, force_retag })
    ]);
    
    if (!topics.length) return jres(400, { error: "No topics found" });
    if (!drops.length) {
      const message = drop_ids ? "No drops found with specified IDs" : "No drops need tagging";
      return jres(200, { message, processed: 0 });
    }

    console.log(`Starting tagging process for ${drops.length} drops with ${topics.length} topics`);
    const results: any[] = [];

    for (const drop of drops) {
      try {
        const raw = await classifyDrop(drop, topics, { max_l3 });
        const enforced = enforce121(raw, topics, { max_l3 });
        
        console.log(`Drop ${drop.id} enforced result:`, enforced);

        // Use new structure: separate L1, L2, L3
        await setDropTags(drop.id, enforced.l1TopicId, enforced.l2TopicId, enforced.l3Tags, raw.language);

        results.push({ 
          id: drop.id, 
          l1_topic_id: enforced.l1TopicId, 
          l2_topic_id: enforced.l2TopicId, 
          l3_tags: enforced.l3Tags, 
          language: raw.language ?? null, 
          ok: true 
        });
      } catch (e) {
        results.push({ id: drop.id, error: String(e), ok: false });
      }
    }

    return jres(200, { processed: results.length, results });
  } catch (err) {
    console.error(err);
    return jres(500, { error: "Internal error", details: String(err) });
  }
}, { onListen: ({ hostname, port }) => console.log(`tag-drops running at http://${hostname}:${port}`) });
