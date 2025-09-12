# Sitemap Generation

This directory contains scripts for generating static sitemaps that are served directly from the domain without redirects.

## Usage

### Manual Generation
```bash
# Set the required environment variable
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the generator
npx tsx scripts/generate-sitemaps.ts
```

### Automatic Generation
Sitemaps are automatically generated daily via GitHub Actions (see `.github/workflows/generate-sitemaps.yml`).

## Files Generated

- `public/sitemap.xml` - Main sitemap index
- `public/sitemap-static.xml` - Static pages
- `public/sitemap-topics.xml` - Topic pages and archives  
- `public/sitemap-articles-001.xml` - Article URLs (chunked at 50k per file)
- `public/sitemap-archives.xml` - Daily archive pages
- `public/robots.txt` - Updated robots.txt with sitemap reference

## Benefits

- ✅ No redirects - files served directly from `dailydrops.cloud`
- ✅ Google Search Console compatible
- ✅ Automatic daily updates
- ✅ Proper URL limits (50k URLs per sitemap file)
- ✅ Clean, canonical HTTPS URLs