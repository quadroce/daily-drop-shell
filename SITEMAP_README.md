# Sitemap System - Daily Drops

## Overview
Dynamic sitemap generation via Supabase Edge Functions with IndexNow integration for Bing.

## Architecture
- `/sitemap.xml` → `serve-sitemap` (index)  
- `/sitemaps/core.xml` → `serve-core-sitemap` (static pages)
- `/sitemaps/topics.xml` → `serve-topics-sitemap` (topic pages)
- `/sitemaps/topics-archive.xml` → `serve-topics-archive-sitemap` (daily archives)

## Key Features
- **Real-time generation** from database
- **ISO 8601 timestamps** with timezone
- **IndexNow integration** for Bing (Google ping deprecated)
- **Logging** to `sitemap_runs` table
- **1-hour caching** headers

## IndexNow Usage
```typescript
import { useIndexNow } from '@/lib/indexnow';
const { submitUrls } = useIndexNow();
await submitUrls(['https://dailydrops.cloud/topics/ai-ml']);
```

## Configuration
- **Key**: `INDEXNOW_KEY` in Supabase secrets
- **Key file**: `/dailydrops-indexnow-2025.txt`
- **robots.txt**: Points to main sitemap
- **Redirects**: Route sitemap URLs to Edge Functions