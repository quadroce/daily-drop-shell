#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITE = 'https://dailydrops.cloud';
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// XML helper functions
const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const xmlWrap = (urls: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${escapeXml(u)}</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod></url>`).join('\n') + 
  `\n</urlset>\n`;

const indexWrap = (parts: { loc: string; lastmod?: string }[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  parts.map(p => 
    `  <sitemap><loc>${escapeXml(p.loc)}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</sitemap>`
  ).join('\n') +
  `\n</sitemapindex>\n`;

const writeFile = async (filename: string, content: string): Promise<void> => {
  const filePath = path.join(PUBLIC_DIR, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`✓ Generated ${filename}`);
};

async function main() {
  console.log('🚀 Generating sitemaps...');

  // Initialize Supabase client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qimelntuxquptqqynxzv.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1) Static pages
  console.log('📄 Generating static sitemap...');
  const staticUrls = [
    '/',
    '/feed', 
    '/pricing',
    '/premium',
    '/topics',
    '/auth',
    '/newsletter',
    '/preferences',
    '/settings'
  ].map(p => `${SITE}${p}`);
  
  await writeFile('sitemap-static.xml', xmlWrap(staticUrls));

  // 2) Topics
  console.log('🏷️  Generating topics sitemap...');
  const { data: topics } = await supabase
    .from('topics')
    .select('slug')
    .eq('is_active', true)
    .order('slug');
    
  const topicUrls: string[] = [];
  
  if (topics) {
    for (const topic of topics) {
      // Topic landing page
      topicUrls.push(`${SITE}/topics/${topic.slug}`);
      // Topic archive page
      topicUrls.push(`${SITE}/topics/${topic.slug}/archive`);
    }
  }
  
  await writeFile('sitemap-topics.xml', xmlWrap(topicUrls));

  // 3) Articles/Drops (chunked into multiple files)
  console.log('📰 Generating articles sitemaps...');
  const { data: drops } = await supabase
    .from('drops')
    .select('id, url, published_at')
    .eq('tag_done', true)
    .order('published_at', { ascending: false })
    .limit(100000); // Reasonable limit

  const articleUrls: string[] = [];
  
  if (drops) {
    for (const drop of drops) {
      // Create clean URLs - prefer using the actual URL if it exists
      if (drop.url) {
        articleUrls.push(drop.url);
      } else {
        articleUrls.push(`${SITE}/drops/${drop.id}`);
      }
    }
  }

  // Chunk articles into multiple sitemaps (50k URLs per file as per Google limits)
  const chunkSize = 50000;
  const articleParts: { loc: string; lastmod?: string }[] = [];
  
  for (let i = 0; i < articleUrls.length; i += chunkSize) {
    const chunk = articleUrls.slice(i, i + chunkSize);
    const partNumber = Math.floor(i / chunkSize) + 1;
    const filename = `sitemap-articles-${partNumber.toString().padStart(3, '0')}.xml`;
    
    await writeFile(filename, xmlWrap(chunk));
    articleParts.push({
      loc: `${SITE}/${filename}`,
      lastmod: new Date().toISOString().split('T')[0]
    });
  }

  // 4) Topic archive pages (for the last 90 days)
  console.log('📅 Generating topic archive sitemaps...');
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  
  const { data: archiveDates } = await supabase
    .from('drops')
    .select('published_at, tags')
    .eq('tag_done', true)
    .gte('published_at', ninetyDaysAgo.toISOString())
    .order('published_at', { ascending: false });

  const archiveUrls = new Set<string>();
  
  if (archiveDates && topics) {
    // Create a map of topic slugs for faster lookup
    const topicSlugs = new Set(topics.map(t => t.slug));
    
    for (const drop of archiveDates) {
      if (drop.published_at && drop.tags) {
        const date = drop.published_at.split('T')[0];
        
        // Add general daily archive
        archiveUrls.add(`${SITE}/archive/${date}`);
        
        // Add topic-specific daily archives for matching topics
        for (const tag of drop.tags) {
          if (topicSlugs.has(tag)) {
            archiveUrls.add(`${SITE}/topics/${tag}/${date}`);
          }
        }
      }
    }
  }
  
  await writeFile('sitemap-archives.xml', xmlWrap(Array.from(archiveUrls)));

  // 5) Generate sitemap index
  console.log('📋 Generating sitemap index...');
  const today = new Date().toISOString().split('T')[0];
  
  const indexParts = [
    { loc: `${SITE}/sitemap-static.xml`, lastmod: today },
    { loc: `${SITE}/sitemap-topics.xml`, lastmod: today },
    { loc: `${SITE}/sitemap-archives.xml`, lastmod: today },
    ...articleParts
  ];
  
  await writeFile('sitemap.xml', indexWrap(indexParts));

  // 6) Update robots.txt
  console.log('🤖 Updating robots.txt...');
  const robotsTxt = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

  await writeFile('robots.txt', robotsTxt);

  console.log('✅ Sitemap generation completed successfully!');
  console.log(`📊 Generated ${staticUrls.length} static URLs, ${topicUrls.length} topic URLs, ${articleUrls.length} article URLs, ${archiveUrls.size} archive URLs`);
}

main().catch(err => {
  console.error('❌ Sitemap generation failed:', err);
  process.exit(1);
});