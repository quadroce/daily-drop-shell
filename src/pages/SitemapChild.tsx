import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const SitemapChild = () => {
  const { filename } = useParams<{ filename: string }>();
  const [sitemap, setSitemap] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) {
      setError('Invalid sitemap filename');
      setLoading(false);
      return;
    }

    const fetchSitemap = async () => {
      try {
        // Construct the path for nested sitemaps
        const sitemapPath = `sitemaps/${filename}`;
        
        const { data, error } = await supabase.functions.invoke('sitemap-proxy', {
          body: { path: sitemapPath }
        });
        
        if (error) {
          console.error('Error fetching sitemap:', error);
          setError('Failed to load sitemap');
          return;
        }

        if (typeof data === 'string') {
          setSitemap(data);
        } else {
          setError('Invalid sitemap format');
        }
      } catch (err) {
        console.error('Exception fetching sitemap:', err);
        setError('Failed to load sitemap');
      } finally {
        setLoading(false);
      }
    };

    fetchSitemap();
  }, [filename]);

  // Set proper headers for XML content
  useEffect(() => {
    if (sitemap) {
      // Set content type for XML
      const head = document.querySelector('head');
      if (head) {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Type';
        meta.content = 'application/xml; charset=utf-8';
        head.appendChild(meta);
      }
    }
  }, [sitemap]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Loading Sitemap...</h1>
        <p className="text-muted-foreground">Please wait while we load the sitemap.</p>
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

  // Render XML as plain text with proper formatting
  return (
    <div style={{ 
      fontFamily: 'monospace', 
      whiteSpace: 'pre-wrap', 
      fontSize: '12px',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #e9ecef'
    }}>
      {sitemap}
    </div>
  );
};