// Utility to check if a date is older than 90 days
export const isOlderThan90Days = (date: Date | string): boolean => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return targetDate < ninetyDaysAgo;
};

// SEO utilities for dynamic meta tags
export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
  ogImage?: string;
}

export const generateSeoMeta = ({
  title,
  description,
  canonical,
  noindex,
  ogImage
}: SeoMeta) => ({
  title,
  description: description.substring(0, 160), // Truncate at 160 chars
  canonical,
  noindex,
  ogImage: ogImage || `${window.location.origin}/og-dailydrops.jpg`
});

// Breadcrumb JSON-LD generator
export interface BreadcrumbItem {
  name: string;
  url: string;
}

export const breadcrumbJsonLd = (items: BreadcrumbItem[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

// Item List JSON-LD generator
export interface ItemListItem {
  name: string;
  url: string;
  image?: string;
  description?: string;
}

export const itemListJsonLd = (
  name: string,
  description: string,
  url: string,
  items: ItemListItem[]
) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": name,
  "description": description,
  "url": url,
  "numberOfItems": items.length,
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "url": item.url,
    ...(item.image && { "image": item.image }),
    ...(item.description && { "description": item.description })
  }))
});

// Collection Page JSON-LD for archive pages
export const collectionPageJsonLd = (
  name: string,
  description: string,
  url: string,
  breadcrumbs?: BreadcrumbItem[]
) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": name,
  "description": description,
  "url": url,
  ...(breadcrumbs && { "breadcrumb": breadcrumbJsonLd(breadcrumbs) })
});

// Article JSON-LD for individual content items
export const articleJsonLd = (
  headline: string,
  description: string,
  url: string,
  datePublished: string,
  author?: string,
  image?: string
) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": headline,
  "description": description,
  "url": url,
  "datePublished": datePublished,
  ...(author && { "author": { "@type": "Person", "name": author } }),
  ...(image && { "image": image })
});