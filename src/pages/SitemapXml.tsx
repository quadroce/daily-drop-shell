import { useEffect } from 'react';

export const SitemapXml = () => {
  useEffect(() => {
    // Redirect directly to the public sitemap file in Supabase storage
    const sitemapUrl = 'https://qimelntuxquptqqynxzv.supabase.co/storage/v1/object/public/public-sitemaps/sitemap.xml';
    window.location.replace(sitemapUrl);
  }, []);

  // Show a brief loading message while redirecting
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Redirecting to Sitemap...</h1>
      <p className="text-muted-foreground">Please wait while we redirect you to the sitemap.</p>
    </div>
  );
};