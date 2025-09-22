// supabase/functions/automated-ingestion/index.ts
// ✔ CORS robusti + invocazioni funzioni uniformi + JSON coerente

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type Json = Record<string, unknown>;

interface ProcessingStats {
  feeds_processed: number;
  new_articles: number;
  ingestion_processed: number;
  articles_tagged: number;
  embeddings_processed?: number;
  errors: string[];
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""; // usato solo per self-trigger opzionale
const SELF_SCHEDULING = false; // ← true se vuoi mantenere il re-trigger orario

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://localhost:5173",
  "https://preview--daily-drop-shell.lovable.app",
  "https://dailydrops.cloud",
]);

// Client service-role (solo lato Edge Function)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- CORS helpers ----------
function getAllowedOrigin(req: Request) {
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.has(origin) ? origin : "*";
}

function corsify(res: Response, req: Request) {
  const origin = getAllowedOrigin(req);
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "authorization,content-type,x-client-info,apikey",
  );
  h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

function preflight(req: Request) {
  return corsify(
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": getAllowedOrigin(req),
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization,content-type,x-client-info,apikey",
        "Vary": "Origin",
      },
    }),
    req,
  );
}

function json(body: Json, status = 200) {
  const h = new Headers({ "Content-Type": "application/json" });
  return new Response(JSON.stringify(body), { status, headers: h });
}

// ---------- Edge function invocation helper ----------
async function callEdgeFunction(
  functionName: string,
  opts?: {
    method?: "GET" | "POST";
    body?: Json;
    query?: Record<string, string | number | boolean | undefined>;
  },
): Promise<any> {
  const method = opts?.method ?? "POST";
  const query = opts?.query ?? {};
  const body = opts?.body ?? {};

  // Se è necessario invocare come GET con querystring (es. fetch-rss paginato)
  if (method === "GET") {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&");
    const url = `${SUPABASE_URL}/functions/v1/${functionName}${
      qs ? `?${qs}` : ""
    }`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`, // service auth
        apikey: SERVICE_ROLE_KEY,
      },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`HTTP ${resp.status} ${functionName}: ${txt}`);
    }
    return await resp.json();
  }

  // Default: invoca via SDK (POST con body JSON)
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { "Content-Type": "application/json" },
  });
  if (error) throw error;
  return data;
}

// ---------- Tiny util ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Core pipeline ----------
async function runAutomatedIngestion(): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    feeds_processed: 0,
    new_articles: 0,
    ingestion_processed: 0,
    articles_tagged: 0,
    embeddings_processed: 0,
    errors: [],
  };

  console.log("🚀 Starting automated content ingestion cycle...");

  // 1) RSS in batch (GET con querystring)
  try {
    console.log("📡 Step 1: Fetching RSS in batches...");
    let offset = 0;
    const limit = 40;
    let hasMore = true;
    let batch = 1;

    while (hasMore) {
      console.log(`📦 RSS batch ${batch} (offset=${offset}, limit=${limit})`);
      try {
        const rss = await callEdgeFunction("fetch-rss", {
          method: "GET",
          query: { offset, limit },
        });
        const feeds = Number(rss?.sources ?? 0);
        const enq = Number(rss?.enqueued ?? 0);
        stats.feeds_processed += feeds;
        stats.new_articles += enq;
        hasMore = Boolean(rss?.has_more);
        if (hasMore) {
          offset += limit;
          batch += 1;
          await sleep(1500);
        }
      } catch (e: any) {
        console.error(`❌ RSS batch ${batch} failed:`, e);
        stats.errors.push(`RSS batch ${batch} failed: ${e?.message || e}`);
        // continua ma metti una guardia per evitare loop infinito
        offset += limit;
        batch += 1;
        hasMore = batch <= 10;
      }
    }
    console.log(
      `✅ RSS done: feeds=${stats.feeds_processed}, new=${stats.new_articles}`,
    );
  } catch (e: any) {
    console.error("❌ RSS step failed:", e);
    stats.errors.push(`RSS step failed: ${e?.message || e}`);
  }

  await sleep(800);

  // 2) Ingestion queue (POST)
  try {
    console.log("🔄 Step 2: Process ingestion queue...");
    const res = await callEdgeFunction("ingest-queue", {
      body: {
        trigger: "automated",
        batch_size: 150,
        timeout_minutes: 15,
        concurrent_processes: 3,
      },
    });
    stats.ingestion_processed = Number(res?.processed ?? 0);
    console.log(`✅ Ingestion processed=${stats.ingestion_processed}`);
  } catch (e: any) {
    console.error("❌ Ingestion failed:", e);
    stats.errors.push(`Ingestion failed: ${e?.message || e}`);
  }

  await sleep(800);

  // 3) Tagging (POST)
  try {
    console.log("🏷️ Step 3: Tagging articles...");
    const res = await callEdgeFunction("tag-drops", {
      body: {
        trigger: "automated",
        batch_size: 80,
        max_articles: 200,
        concurrent_requests: 5,
      },
    });
    stats.articles_tagged = Number(res?.tagged ?? 0);
    console.log(`✅ Tagging tagged=${stats.articles_tagged}`);
  } catch (e: any) {
    console.error("❌ Tagging failed:", e);
    stats.errors.push(`Tagging failed: ${e?.message || e}`);
  }

  await sleep(800);

  // 4) Embeddings (POST)
  try {
    console.log("🧠 Step 4: Embeddings...");
    const res = await callEdgeFunction("automated-embeddings", {
      body: { action: "embeddings", since_minutes: 120 },
    });
    stats.embeddings_processed = Number(res?.result?.processed ?? 0);
    console.log(`✅ Embeddings processed=${stats.embeddings_processed}`);
  } catch (e: any) {
    console.error("❌ Embeddings failed:", e);
    stats.errors.push(`Embeddings failed: ${e?.message || e});
  }

  // Log su DB (best-effort)
  try {
    await supabase.from("ingestion_logs").insert({
      cycle_timestamp: new Date().toISOString(),
      feeds_processed: stats.feeds_processed,
      new_articles: stats.new_articles,
      ingestion_processed: stats.ingestion_processed,
      articles_tagged: stats.articles_tagged,
      embeddings_processed: stats.embeddings_processed ?? 0,
      errors: stats.errors,
      success: stats.errors.length === 0,
    });
  } catch (e) {
    console.warn("⚠️ Failed to insert ingestion_logs:", e);
  }

  return stats;
}

// ---------- (Optional) self-scheduling ----------
function scheduleNextExecution() {
  if (!SELF_SCHEDULING) return;
  try {
    console.log("🕐 Scheduling next run in 1 hour...");
    // Nota: le Edge Functions non sono pensate per timer lunghi; preferisci i cron Supabase.
// @ts-ignore Deno timer ok in edge runtime ma non affidarti in produzione
    setTimeout(async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/automated-ingestion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY || SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ trigger: "auto_scheduled" }),
        });
        if (!resp.ok) {
          console.error("❌ Self trigger failed:", await resp.text());
        } else {
          console.log("✅ Self trigger fired");
        }
      } catch (e) {
        console.error("❌ Self trigger error:", e);
      }
    }, 60 * 60 * 1000);
  } catch (e) {
    console.error("❌ Scheduling error:", e);
  }
}

// ---------- HTTP entry ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    const { trigger = "manual" } = await req.json().catch(() => ({ trigger: "manual" }));
    console.log(`🔥 Automated ingestion triggered: ${trigger}`);

    // opzionale: gate su tabella cron_jobs
    try {
      const { data } = await supabase
        .from("cron_jobs")
        .select("enabled")
        .eq("name", "auto-ingest-worker")
        .single();
      if (data && data.enabled === false) {
        const resp = json({
          success: false,
          message: "Automated ingestion is disabled",
          trigger,
        }, 200);
        return corsify(resp, req);
      }
    } catch (_e) {
      // se la tabella non esiste o fallisce, non bloccare
    }

    const stats = await runAutomatedIngestion();

    if (trigger === "manual" || trigger === "restart") {
      scheduleNextExecution();
    }

    return corsify(
      json({
        success: true,
        message: "Automated ingestion completed",
        stats,
        trigger,
        ts: new Date().toISOString(),
        next: SELF_SCHEDULING ? "in 1 hour" : "cron-managed",
      }),
      req,
    );
  } catch (error: any) {
    console.error("🚨 Automated ingestion error:", error);
    return corsify(
      json(
        { success: false, error: error?.message || String(error), ts: new Date().toISOString() },
        500,
      ),
      req,
    );
  }
});
