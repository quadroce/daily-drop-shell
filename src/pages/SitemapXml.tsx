import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const SitemapXml = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xmlContent, setXmlContent] = useState<string>('');

  useEffect(() => {
    const serveSitemap = async () => {
      try {
        // Try to fetch sitemap from storage
        const { data, error: storageError } = await supabase.storage
          .from('public-sitemaps')
          .download('sitemap.xml');

        if (storageError || !data) {
          throw new Error('Sitemap not found in storage');
        }

        const text = await data.text();
        
        // Create a response with proper XML headers and serve it
        const response = new Response(text, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          }
        });

        // Convert response to blob and create object URL
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Navigate to the XML content
        window.open(url, '_self');

      } catch (err) {
        console.error('Error serving sitemap:', err);
        setError('Sitemap not available');
        setLoading(false);
      }
    };

    serveSitemap();
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Loading Sitemap...</h1>
        <p className="text-muted-foreground">Please wait while we fetch the sitemap.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Sitemap Not Available</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <p className="text-sm text-muted-foreground">
          The sitemap may still be generating. Please try again in a few minutes.
        </p>
      </div>
    );
  }

  return null;
};