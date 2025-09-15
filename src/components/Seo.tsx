import { useEffect } from "react";

export type SeoProps = {
  title: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any>;
  ogImage?: string;
  ogType?: string;
  article?: {
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  howTo?: {
    name: string;
    description: string;
    steps: Array<{
      name: string;
      text: string;
    }>;
  };
};

export const Seo = ({ 
  title, 
  description, 
  canonical, 
  noindex, 
  jsonLd, 
  ogImage, 
  ogType = "website",
  article,
  faq,
  howTo
}: SeoProps) => {
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

    // Remove existing structured data
    const existingStructuredData = document.querySelectorAll('script[type="application/ld+json"]');
    existingStructuredData.forEach(script => script.remove());

    // Build structured data array
    const structuredDataArray: any[] = [];

    // Add custom JSON-LD
    if (jsonLd) {
      structuredDataArray.push(jsonLd);
    }

    // Add Article schema
    if (article) {
      structuredDataArray.push({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": description,
        "author": article.author ? {
          "@type": "Person",
          "name": article.author
        } : undefined,
        "datePublished": article.publishedTime,
        "dateModified": article.modifiedTime,
        "articleSection": article.section,
        "keywords": article.tags?.join(", "),
        "url": canonical,
        "image": ogImage
      });
    }

    // Add FAQ schema
    if (faq && faq.length > 0) {
      structuredDataArray.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq.map(item => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      });
    }

    // Add HowTo schema
    if (howTo) {
      structuredDataArray.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": howTo.name,
        "description": howTo.description,
        "step": howTo.steps.map((step, index) => ({
          "@type": "HowToStep",
          "position": index + 1,
          "name": step.name,
          "text": step.text
        }))
      });
    }

    // Add all structured data
    structuredDataArray.forEach(data => {
      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });
  }, [title, description, canonical, noindex, jsonLd, ogImage, ogType, article, faq, howTo]);

  return null;
};