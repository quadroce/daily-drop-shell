import { getTopicsForSitemap, getAvailableDatesForSitemap } from './api/topics';

export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

export const generateSitemapUrls = async (): Promise<SitemapUrl[]> => {
  const baseUrl = window.location.origin;
  const urls: SitemapUrl[] = [];

  try {
    // Get all topics
    const topics = await getTopicsForSitemap();
    
    for (const topic of topics) {
      // Topic landing page
      urls.push({
        loc: `${baseUrl}/topics/${topic.slug}`,
        changefreq: 'daily',
        priority: 0.8
      });

      // Topic archive page
      urls.push({
        loc: `${baseUrl}/topics/${topic.slug}/archive`,
        changefreq: 'weekly',
        priority: 0.6
      });

      // Daily archive pages
      const dates = await getAvailableDatesForSitemap(topic.slug);
      dates.forEach(date => {
        urls.push({
          loc: `${baseUrl}/topics/${topic.slug}/${date}`,
          lastmod: date,
          changefreq: 'monthly',
          priority: 0.4
        });
      });
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return urls;
};

export const generateSitemapXml = async (): Promise<string> => {
  const urls = await generateSitemapUrls();
  
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const urlsetClose = '</urlset>';

  const urlEntries = urls.map(url => {
    const entries = [`    <loc>${url.loc}</loc>`];
    
    if (url.lastmod) {
      entries.push(`    <lastmod>${url.lastmod}</lastmod>`);
    }
    if (url.changefreq) {
      entries.push(`    <changefreq>${url.changefreq}</changefreq>`);
    }
    if (url.priority) {
      entries.push(`    <priority>${url.priority}</priority>`);
    }

    return `  <url>\n${entries.join('\n')}\n  </url>`;
  }).join('\n');

  return [xmlHeader, urlsetOpen, urlEntries, urlsetClose].join('\n');
};