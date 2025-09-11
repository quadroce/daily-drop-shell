import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export const SitemapChild = () => {
  const { filename } = useParams<{ filename: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) {
      setError('Invalid sitemap filename');
      return;
    }

    // Redirect directly to the public sitemap file in Supabase storage
    const sitemapUrl = `https://qimelntuxquptqqynxzv.supabase.co/storage/v1/object/public/public-sitemaps/sitemaps/${filename}`;
    window.location.replace(sitemapUrl);
  }, [filename]);

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

  // Show a brief loading message while redirecting
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Redirecting to Sitemap...</h1>
      <p className="text-muted-foreground">Please wait while we redirect you to the sitemap.</p>
    </div>
  );
};