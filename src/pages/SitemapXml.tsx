import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const SitemapXml = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        // Set proper XML content type and serve the sitemap
        const blob = new Blob([text], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        
        // Replace the current page with the XML content
        window.location.replace(url);

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