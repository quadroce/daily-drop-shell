import { useEffect } from "react";

export type SeoProps = {
  title: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any>;
  ogImage?: string;
  ogType?: string;
};

export const Seo = ({ title, description, canonical, noindex, jsonLd, ogImage, ogType = "website" }: SeoProps) => {
  useEffect(() => {
    // Set document title
    document.title = title;

    // Set meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    if (description) {
      metaDescription.setAttribute('content', description);
    }

    // Set canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    if (canonical) {
      canonicalLink.setAttribute('href', canonical);
    }

    // Set noindex
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

    // Add Open Graph meta tags
    const setOrUpdateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    setOrUpdateMeta('og:title', title);
    setOrUpdateMeta('og:type', ogType);
    if (description) setOrUpdateMeta('og:description', description);
    if (canonical) setOrUpdateMeta('og:url', canonical);
    if (ogImage) setOrUpdateMeta('og:image', ogImage);

    // Add Twitter Card meta tags
    const setOrUpdateTwitterMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    setOrUpdateTwitterMeta('twitter:card', 'summary_large_image');
    setOrUpdateTwitterMeta('twitter:title', title);
    if (description) setOrUpdateTwitterMeta('twitter:description', description);
    if (ogImage) setOrUpdateTwitterMeta('twitter:image', ogImage);

    // Add JSON-LD structured data
    if (jsonLd) {
      let structuredData = document.querySelector('script[type="application/ld+json"]');
      if (structuredData) {
        document.head.removeChild(structuredData);
      }
      structuredData = document.createElement('script');
      structuredData.setAttribute('type', 'application/ld+json');
      structuredData.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(structuredData);
    }
  }, [title, description, canonical, noindex, jsonLd, ogImage, ogType]);

  return null;
};