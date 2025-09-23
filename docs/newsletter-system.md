# Newsletter System Documentation

## Overview

The enhanced newsletter system provides cache-first content delivery with safe fallbacks, conditional rendering, and comprehensive testing. It addresses the key issues of "Untitled" articles, missing images, and fake publication dates.

## Architecture

### Core Components

1. **Payload Builder** (`payload.ts`) - Cache-first content selection with personalization
2. **Utilities** (`utils.ts`) - Safe transformations, UTM handling, diversity enforcement
3. **Template** (`template.ts`) - Conditional HTML rendering with fallbacks
4. **Preview Endpoint** (`newsletter-preview/index.ts`) - QA testing interface

### Database View

```sql
-- drops_email_ready view provides safe fallbacks
SELECT
  d.id,
  d.url,
  COALESCE(NULLIF(BTRIM(d.title), ''), INITCAP(SPLIT_PART(d.url, '/', 3))) AS title_safe,
  CASE WHEN d.published_at IS NOT NULL THEN d.published_at ELSE d.created_at END AS date_safe,
  NULLIF(BTRIM(d.image_url), '') AS image_url,
  COALESCE(s.name, 'Unknown Source') AS source_name,
  d.tags, d.summary, d.type, d.lang_code
FROM public.drops d
LEFT JOIN public.sources s ON d.source_id = s.id
WHERE d.tag_done = true;
```

## Configuration

### Environment Variables

```bash
# Newsletter system configuration
USE_NEW_NEWSLETTER_SYSTEM=true          # Enable new system
NEWSLETTER_MAX_AGE_DAYS=30              # Content freshness limit
NEWSLETTER_CACHE_ONLY=false             # Cache-only mode
NEWSLETTER_MAX_PER_SOURCE=2             # Diversity constraint
```

### Feature Flag

The system includes a feature flag for gradual rollout:

```typescript
const useNewSystem = Deno.env.get('USE_NEW_NEWSLETTER_SYSTEM') === 'true';
```

## Safe Fallbacks

### Title Safety
1. **Primary**: `BTRIM(title)` (cleaned title)
2. **Secondary**: `BTRIM(original_title)` (if available)
3. **Fallback**: `hostname(url)` (domain name)

### Date Safety
1. **Primary**: `published_at` (actual publication date)
2. **Fallback**: `created_at` (ingestion date)

### Image Safety
1. **Primary**: `image_url` (if present and not empty)
2. **YouTube**: Auto-generated thumbnail for YouTube URLs
3. **Fallback**: No image (conditional rendering)

### User Greeting
1. **Primary**: `display_name`
2. **Secondary**: `first_name`
3. **Tertiary**: Email local part
4. **Fallback**: "there"

## Content Selection Logic

### Cache-First Approach

```typescript
// 1. Try user_feed_cache (fresh within 24h)
const cachedItems = await getUserFeedCache(userId, supabase, 24);

// 2. Fallback to direct query with filters
if (cachedItems.length === 0) {
  items = await selectDirectFromDrops(maxAgeDays, prefs, supabase);
}

// 3. Apply diversity constraints
const diverseItems = enforceDiversity(items, maxPerSource);
```

### Personalization Filters

- **Language**: Respects `language_prefs` from user profile
- **Topics**: Filters by `selected_topic_ids` from preferences
- **Freshness**: Configurable age limit (default 30 days)
- **Diversity**: Max items per source (default 2)

## Template Features

### Conditional Rendering

```html
<!-- Only render image if present -->
${item.image ? `<img src="${item.image}" alt="${item.title}" />` : ''}

<!-- Only render date if valid -->
${item.showDate ? renderArticleMeta(item.date) : ''}

<!-- Empty state handling -->
${digest.items.length > 0 ? renderArticles(digest.items) : renderEmptyState()}
```

### UTM Parameter Handling

```typescript
// Safely add UTM params, preserving existing ones
const urlWithUtm = addOrPreserveUtm(item.url, {
  utm_source: 'newsletter',
  utm_medium: 'email',
  utm_campaign: 'daily_drop',
});
```

## Preview & Testing

### Preview Endpoint

```bash
# HTML preview
GET /functions/v1/newsletter-preview?userId=<UUID>&cadence=daily&slot=morning

# JSON payload (debugging)
GET /functions/v1/newsletter-preview?userId=<UUID>&format=json
```

### Running Tests

```bash
# Run unit tests
deno test supabase/functions/newsletter/tests.ts

# Integration testing
cd supabase/functions/newsletter
deno run --allow-all tests.ts
```

### Verification Queries

```sql
-- Check for missing titles
SELECT COUNT(*) FILTER (WHERE title_safe = split_part(url, '/', 3)) as hostname_fallbacks,
       COUNT(*) as total 
FROM drops_email_ready;

-- User cache freshness
SELECT user_id, COUNT(*) as cached_items, MAX(created_at) as latest_cache
FROM user_feed_cache 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id;

-- Content age distribution
SELECT 
  CASE 
    WHEN date_safe >= NOW() - INTERVAL '1 day' THEN '0-1 days'
    WHEN date_safe >= NOW() - INTERVAL '7 days' THEN '1-7 days'
    WHEN date_safe >= NOW() - INTERVAL '30 days' THEN '7-30 days'
    ELSE '30+ days'
  END as age_bucket,
  COUNT(*) as items
FROM drops_email_ready
GROUP BY age_bucket
ORDER BY age_bucket;
```

## Rollback Strategy

### Feature Flag Rollback

```bash
# Disable new system immediately
export USE_NEW_NEWSLETTER_SYSTEM=false
```

### Gradual Migration

1. **Phase 1**: Enable for test users only
2. **Phase 2**: Enable for premium users (smaller group)
3. **Phase 3**: Full rollout to all users

### Monitoring

- **Success Rate**: Track `delivery_log` success/failure ratio
- **Content Quality**: Monitor title/image fallback usage
- **User Engagement**: Compare click-through rates
- **Performance**: Monitor function execution time

## Troubleshooting

### Common Issues

1. **Empty Newsletters**: Check cache freshness and user preferences
2. **Missing Images**: Verify YouTube thumbnail generation
3. **Bad Titles**: Review title fallback logic
4. **Template Errors**: Check conditional rendering syntax

### Debug Endpoints

```bash
# Check user preferences
GET /rest/v1/preferences?user_id=eq.<UUID>

# Check feed cache
GET /rest/v1/user_feed_cache?user_id=eq.<UUID>

# Test drops view
GET /rest/v1/drops_email_ready?limit=5
```

## Performance Considerations

- **Cache Hit Rate**: Aim for >80% cache hits during peak times
- **Query Optimization**: Use indexed fields for filtering
- **Batch Processing**: Process users in batches with delays
- **Template Size**: Keep HTML under 100KB for email clients

## Security Notes

- All database queries use RLS policies
- Preview endpoint should be restricted to admins
- UTM parameters are safely encoded
- No user data is logged in production mode