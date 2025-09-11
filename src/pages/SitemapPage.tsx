import { useEffect, useState } from 'react';
import { generateSitemapXml } from '@/lib/sitemap';

export const SitemapPage = () => {
  const [sitemap, setSitemap] = useState<string>('');

  useEffect(() => {
    const loadSitemap = async () => {
      try {
        const xml = await generateSitemapXml();
        setSitemap(xml);
        
        // Set response headers for XML
        document.title = 'Sitemap';
        
        // For actual deployment, this would be handled server-side
        // Here we just display the XML content
      } catch (error) {
        console.error('Error generating sitemap:', error);
        setSitemap('Error generating sitemap');
      }
    };

    loadSitemap();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sitemap XML</h1>
      <div className="bg-muted p-4 rounded-lg overflow-auto">
        <pre className="text-sm whitespace-pre-wrap">{sitemap}</pre>
      </div>
      <p className="text-sm text-muted-foreground mt-4">
        In production, this would be served at /sitemap.xml with proper XML headers.
      </p>
    </div>
  );
};