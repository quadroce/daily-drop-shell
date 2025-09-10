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

async function fetchDrops(limit: number): Promise<Drop[]> {
  // Drops che necessitano tagging (usa la tua condizione – qui tag_done=false se esiste)
  const query = `/rest/v1/drops?select=id,title,summary,language&tag_done=is.false&order=created_at.desc&limit=${limit}`;
  const res = await supa(query);
  return await res.json();
}

// ===== LLM classification =====
function buildPrompt(availableSlugs: string[], params: { max_l3?: number }) {
  const list = availableSlugs.join(", ");
  const maxL3 = Math.max(0, params.max_l3 ?? 3);
  return `You are a strict taxonomy router. You MUST return a JSON object with this exact shape:
{
  "l1": "<one slug>",
  "l2": "<one slug>",
  "l3": ["<zero or more slugs>"],
  "language": "<optional 2-letter code>"
}
Rules:
- Allowed slugs are ONLY from this list: [${list}]
- Exactly 1 for l1, exactly 1 for l2, and 0..${maxL3} for l3 (all distinct).
- l1 must be a Level-1 topic, l2 Level-2, l3 Level-3.
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status} ${await res.text()}`);
  const out = await res.json();
  const txt = out.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(txt); } catch {
    parsed = { l1: "", l2: "", l3: [] };
  }
  // Normalize
  parsed.l1 = String(parsed.l1 || "");
  parsed.l2 = String(parsed.l2 || "");
  parsed.l3 = Array.isArray(parsed.l3) ? parsed.l3.map(String) : [];
  if (parsed.language) parsed.language = String(parsed.language).slice(0, 5);
  return parsed as ClassifyOut;
}

// ===== Post-processing / enforcement =====
function byLevelMap(topics: Topic[]) {
  const bySlug = new Map<string, Topic>(topics.map(t => [t.slug, t]));
  return { bySlug };
}

function enforce121(result: ClassifyOut, topics: Topic[], params: {max_topics_per_drop?: number; max_l3?: number}) {
  const { bySlug } = byLevelMap(topics);
  const maxL3 = Math.max(0, params.max_l3 ?? Math.max(0, (params.max_topics_per_drop ?? 5) - 2));

  const l1 = bySlug.get(result.l1);
  const l2 = bySlug.get(result.l2);
  const l3 = (result.l3 || []).map(s => bySlug.get(s)).filter(Boolean) as Topic[];

  // Pick-first fallback if wrong level/missing
  const pickOne = (arr: Topic[], level: number) => (arr.find(t => t.level === level) ?? arr[0]);

  const candidatesL1 = topics.filter(t => t.level === 1);
  const candidatesL2 = topics.filter(t => t.level === 2);

  const finalL1 = (l1?.level === 1 ? l1 : pickOne(candidatesL1, 1)).slug;
  const finalL2 = (l2?.level === 2 ? l2 : pickOne(candidatesL2, 2)).slug;

  // L3: only level 3, unique, cap
  const finalL3 = Array.from(new Set(l3.filter(t => t.level === 3).map(t => t.slug))).slice(0, maxL3);

  return { l1: finalL1, l2: finalL2, l3: finalL3 };
}

// ===== Write topics using new RPC =====
async function setDropTags(dropId: number, tags: string[], language?: string) {
  await supa(`/rest/v1/rpc/set_drop_tags`, {
    method: "POST",
    body: JSON.stringify({ 
      p_id: dropId, 
      p_tags: tags, 
      p_tag_done: true 
    }),
  });
  
  // Update language separately if provided
  if (language) {
    await supa(`/rest/v1/drops?id=eq.${dropId}`, { 
      method: "PATCH", 
      body: JSON.stringify({ language }) 
    });
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

    // Load config
    const [topics, drops] = await Promise.all([fetchTopics(), fetchDrops(limit)]);
    if (!topics.length) return jres(400, { error: "No topics found" });
    if (!drops.length)  return jres(200, { message: "No drops need tagging", processed: 0 });

    const allSlugs = topics.map(t => t.slug);
    const results: any[] = [];

    for (const drop of drops) {
      try {
        const raw = await classifyDrop(drop, allSlugs, { max_l3 });
        const enforced = enforce121(raw, topics, { max_l3 });

        // Use new RPC that handles tags -> topics sync automatically
        const tags = [enforced.l1, enforced.l2, ...enforced.l3];
        await setDropTags(drop.id, tags, raw.language);

        results.push({ id: drop.id, l1: enforced.l1, l2: enforced.l2, l3: enforced.l3, language: raw.language ?? null, ok: true });
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
