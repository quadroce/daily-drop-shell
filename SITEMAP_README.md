# DailyDrop Sitemap System

## Overview

The DailyDrop sitemap system provides automated SEO-ready XML sitemaps with daily updates and automatic search engine notifications. The system generates multiple sitemap files optimized for different content types and automatically pings Google and Bing when updated.

## Architecture

### Sitemap Structure
- **Main Index**: `/sitemap.xml` - References all child sitemaps
- **Core Pages**: `/sitemaps/core.xml` - Static pages (/, /pricing, /topics)
- **Topics**: `/sitemaps/topics.xml` - All active topic landing and archive pages
- **Topic Archives**: `/sitemaps/topics-archive.xml` - Daily topic archives (90-day rolling window)

### Components
1. **Supabase Edge Function**: `generate-sitemap` - Handles sitemap generation
2. **Storage Bucket**: `public-sitemaps` - Stores generated XML files
3. **Cron Job**: Daily execution at 4:00 UTC
4. **Admin Interface**: `/admin/sitemap` - Manual generation and monitoring
5. **Public Routes**: Serve sitemaps from storage

## Features

### ✅ Implemented
- **Multi-sitemap index structure** for scalability
- **Daily automated generation** at 4:00 UTC
- **90-day rolling archive window** for topic-specific content
- **Automatic search engine pings** (Google & Bing)
- **Storage-based serving** via Supabase public bucket
- **Admin dashboard** for manual triggers and monitoring
- **Run history tracking** with success/failure logging
- **Proper XML formatting** with lastmod, changefreq, and priority
- **robots.txt integration** with sitemap reference

### 📋 Configuration

#### Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for edge function
- Base URL is currently hardcoded as `https://dailydrop.com` in the edge function

#### Database Tables
- `sitemap_runs` - Tracks generation history and statistics
- `topics` - Active topics for sitemap inclusion
- `drops` - Content for archive URL generation

#### Storage Bucket
- `public-sitemaps` - Public bucket for serving XML files

## Usage

### Automatic Generation
Sitemaps are automatically generated daily at 4:00 UTC via cron job. No manual intervention required.

### Manual Generation
1. Navigate to `/admin/sitemap`
2. Click "Generate Sitemap" button
3. Monitor progress in the generation history

### API Endpoints
- `POST /functions/v1/generate-sitemap` - Trigger manual generation
- `GET /sitemap.xml` - Main sitemap index
- `GET /sitemaps/core.xml` - Core pages sitemap
- `GET /sitemaps/topics.xml` - Topics sitemap
- `GET /sitemaps/topics-archive.xml` - Topic archives sitemap

## Technical Details

### URL Coverage
**Included URLs:**
- `/` (homepage)
- `/pricing`
- `/topics` (topics index)
- `/topics/{slug}` (topic landing pages)
- `/topics/{slug}/archive` (topic archive index)
- `/topics/{slug}/YYYY-MM-DD` (daily topic archives with content)

**Excluded URLs:**
- Private pages: `/auth`, `/profile`, `/preferences`, `/admin`, `/feed`
- User-specific pages
- Empty archive pages (no content for that topic/date)

### Archive Window Logic
- **Window**: Last 90 days from current date (Rome timezone)
- **Content check**: Only includes archive URLs with actual content
- **Rolling**: Window automatically moves forward daily

### SEO Optimization
- **lastmod**: Set to content update timestamp or current date
- **changefreq**: Optimized per content type (daily/weekly/monthly)
- **priority**: Hierarchical based on content importance
- **XML compression**: Ready for gzip compression
- **Size limits**: Designed to stay under 50,000 URLs per sitemap

## Monitoring

### Admin Dashboard (`/admin/sitemap`)
- View recent generation runs
- Monitor success/failure rates
- Check search engine ping status
- Manual generation trigger
- URL statistics

### Run History
Each generation run tracks:
- Start/completion timestamps
- Success/failure status
- Total URLs generated
- Topics count
- Archive URLs count
- Google/Bing ping results
- Error messages (if any)

## Search Engine Integration

### Automatic Pings
After successful generation, the system automatically notifies:
- **Google**: `https://www.google.com/ping?sitemap={BASE_URL}/sitemap.xml`
- **Bing**: `https://www.bing.com/ping?sitemap={BASE_URL}/sitemap.xml`

### robots.txt
The system automatically includes the sitemap reference in `/public/robots.txt`:
```
Sitemap: https://dailydrop.com/sitemap.xml
```

## Troubleshooting

### Common Issues

1. **Generation Fails**
   - Check edge function logs
   - Verify database connectivity
   - Ensure topics table has active records

2. **Sitemaps Not Accessible**
   - Verify storage bucket permissions
   - Check public access policies
   - Confirm route configuration

3. **Search Engine Pings Fail**
   - Network connectivity issues
   - Rate limiting from search engines
   - Invalid sitemap URLs

### Logs and Debugging
- Edge function logs: Supabase Functions dashboard
- Generation history: Admin sitemap dashboard
- Storage access: Supabase Storage dashboard

## Maintenance

### Regular Tasks
- Monitor generation success rates
- Review URL count trends
- Check search engine ping success
- Verify archive window accuracy

### Updates Required
- Update base URL when domain changes
- Adjust archive window if content strategy changes
- Add new static pages to core sitemap as needed

## Performance

### Optimizations
- Parallel sitemap generation
- Efficient database queries
- Storage-based serving (no real-time generation)
- Compressed XML ready

### Scalability
- Multiple sitemap files for large URL counts
- 90-day archive window prevents unlimited growth
- Efficient topic-based content filtering

## Security

### Access Control
- Public read access to sitemap files
- Admin-only access to generation interface
- Service role protected edge function
- RLS policies on sitemap_runs table

### Data Privacy
- No user-specific data in sitemaps
- Only public content URLs included
- No sensitive information exposure