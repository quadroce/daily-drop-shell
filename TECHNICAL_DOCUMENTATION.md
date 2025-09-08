# DailyDrop Shell – Comprehensive Technical Documentation

This document provides an exhaustive, **technical deep‑dive** into the DailyDrop Shell system, covering architecture, database schema, ingestion pipeline, ranking logic, APIs, UI/UX flow, and deployment strategies. It is designed for engineers who need to understand, extend, and maintain the platform.

---

## 1. System Architecture

**Frontend**

* Built with **React (TypeScript)** + **Vite**.
* Component library: **shadcn/ui** (built on **Radix Primitives** + TailwindCSS).
* Routing: **react-router-dom** with protected routes for authenticated users.
* State management: local React context + Supabase client state.

**Backend**

* **Supabase** provides:

  * PostgreSQL (with pgvector extension)
  * Authentication (email, OAuth planned)
  * Row Level Security (RLS)
  * Edge Functions (Deno)
  * Realtime channels (future use for live updates)

**Infrastructure**

* Local dev: Docker containers managed by Supabase CLI.
* Production: Deployed via Vercel/Render (frontend) + Supabase hosted backend.

**Integrations**

* External APIs: YouTube Data API, OpenAI API (for embeddings + tagging).
* Analytics: Google Analytics planned integration.

---

## 2. Database Schema

### Core Tables

* **sources** – metadata for RSS, YouTube, Reddit, etc.
* **topics** – hierarchical taxonomy with 3 levels:

  * Level 1: Macro categories (≤8)
  * Level 2: Seed categories (≤32)
  * Level 3: Micro topics (≥100)
* **content** – ingested articles/videos with metadata (title, url, summary, image, etc.).
* **content\_topics** – join table for content ↔ topics.
* **user\_preferences** – stores user topic preferences.
* **user\_profile\_vectors** – vector embeddings of user interests for personalization.

### Indices & Extensions

* **pgvector** for similarity search (`vector(1536)` columns).
* Indexes on `content.created_at`, `content.source_id`, `topics.slug` for fast retrieval.

### Policies

* Row Level Security: enforced on user‑specific tables.
* Service role key used by ingestion functions, not exposed to client.

---

## 3. Ingestion Pipeline

### Functions (Supabase Edge Functions)

* **fetch-rss** → pulls articles from configured RSS feeds.
* **ingest-queue** → processes items, deduplicates, inserts normalized content.
* **scrape-og** → extracts OpenGraph metadata (title, desc, image).
* **tag-drops** → assigns hierarchical topics to content.
* **content-ranking** → calculates ranking score for each content item.
* **background-feed-ranking** → periodic refresh of scores.
* **admin-api** → protected endpoints for dashboard data.
* **restart-ingestion** → maintenance utility.

### Scheduling

* Cron jobs managed via Supabase Dashboard (e.g., RSS fetch every 6h).

### Flow

1. `fetch-rss` adds entries → `ingest_queue`.
2. `ingest-queue` validates, enriches, stores in `content`.
3. `scrape-og` resolves images & metadata.
4. `tag-drops` applies topic classification.
5. `content-ranking` computes score.
6. Feed built daily with at least one YouTube fallback.

---

## 4. Ranking System

**Catalog Score**

* Recency (0.4)
* Authority (0.25)
* Quality (0.2)
* Popularity (0.15)
* Penalties (duplicates, low trust sources)

**User Personalization**

* Topic Match
* Vector Similarity (pgvector search)
* Feedback (like/dislike/open/dismiss)

**Final Score**

```
Final = 0.3 * Catalog + 0.35 * TopicMatch + 0.35 * VectorSim ± Adjustments
```

**Constraints**

* ≥ 1 YouTube per Drop
* ≤ 2 items per source
* ≤ 1 sponsored content
* Corporate boost toggle

**Missing features (roadmap)**

* Diversity engine (source/topic variety enforcement).
* Fine‑grained feedback loops.

---

## 5. Authentication & Authorization

* **Supabase Auth**: email/password today; Google/LinkedIn planned.
* `useAuth` hook manages user + session state.
* Protected routes via `RequiredAuth` + `Layout` pattern.
* Role‑based access: `admin` and `editor` roles allow access to `/admin` dashboard.

---

## 6. Frontend Routes

* `/` – landing page
* `/auth` – login/signup
* `/reset-password` – password recovery
* `/feed` – personalized daily feed
* `/preferences` – topic selector
* `/profile` – user settings
* `/u/:username` – public profile
* `/admin` – admin dashboard
* `*` – 404 fallback

---

## 7. UI / UX Flow

**Onboarding**

* User signs up → selects interests (topics).
* Preferences stored in `user_preferences` + embedded into `user_profile_vectors`.

**Feed Rendering**

* Fetches ranked `content` filtered by user preferences.
* Embeds YouTube player for videos (premium gating planned).
* Bookmark, dismiss, like/dislike feedback updates personalization.

**Admin Dashboard**

* Shows ingestion queue counts, content counts, error logs.
* Allows manual re‑ranking, tagging fixes.

---

## 8. Deployment

**Frontend**

* Static build with Vite → `dist/`.
* Deployment options:

  * **Vercel** (recommended) → auto build on push.
  * **Render** (Static Site) → build command `npm run build`, publish dir `dist`.

**Backend**

* Supabase hosted project for Postgres + Auth + Functions.
* Functions deployed with:

  ```bash
  supabase functions deploy <name>
  ```
* Schedules set via Supabase Dashboard.

---

## 9. Local Development (Windows)

**Prerequisites**

* Node.js ≥ 18 (prefer 20)
* Git
* Docker Desktop (WSL2)
* Supabase CLI
* Deno
* VS Code/Visual Studio

**Steps**

1. Clone repo → `npm install`
2. Start Supabase local → `supabase start`
3. Apply schema → `supabase db reset`
4. Create `.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
5. Run dev server → `npm run dev`
6. Access at `http://localhost:8080`

---

## 10. Security Considerations

* Never expose service role keys in frontend.
* Enforce RLS for all user‑owned tables.
* Use environment variables for secrets.
* Protect admin functions with JWT verification.
* Plan for monitoring ingestion anomalies.

---

## 11. Roadmap Enhancements

* RSS + Reddit ingestion (growth milestone).
* Discord + Telegram bots (free tier).
* WhatsApp delivery (Pro tier).
* Push notifications (OneSignal).
* Analytics dashboards for engagement.
* Content feedback loop fine‑tuned with ML.

---

## 12. Troubleshooting

**Issue: Redirect loop to /auth**

* Wrong env vars → check `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
* Supabase local not running.

**Issue: Duplicate constraints**

* Use `supabase db reset` to drop & reapply schema.

**Issue: Docker errors on Windows**

* Restart Docker Desktop with WSL2 backend.
* Run `wsl --shutdown` then restart.

**Issue: CORS errors from Edge Functions**

* Add CORS headers in function handler.
* For local, use `--no-verify-jwt`.

---

## 13. Quick Reference Commands

```bash
# Start Supabase local
docker start supabase
supabase start

# Reset DB
supabase db reset

# Run frontend
npm run dev

# Build frontend
npm run build

# Deploy function
supabase functions deploy fetch-rss
```

---

## 14. Conclusion

DailyDrop Shell is a full‑stack AI‑assisted content curation platform. The architecture combines a React SPA frontend with a Supabase backend (Postgres + Edge Functions). It provides ingestion from multiple sources, hierarchical tagging, a ranking engine, and a personalized daily feed. This document serves as the technical reference for setup, maintenance, and further development.
