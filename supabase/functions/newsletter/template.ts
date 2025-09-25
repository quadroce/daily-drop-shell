// Enhanced newsletter template with conditional rendering
import { DigestPayload } from './payload.ts';
import { TransformedItem } from './utils.ts';

export function renderNewsletterTemplate(content: DigestPayload): string {
  const { user, digest, testMode, unsubscribeUrl, preferencesUrl } = content;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${testMode ? "[TEST] " : ""}Your ${digest.cadence} digest</title>
        <style>
          /* Reset and base styles */
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #1a1a1a; 
            margin: 0;
            padding: 0;
            background: #fbfcff;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
          }
          
          /* Header with logo */
          .header { 
            background: linear-gradient(135deg, #2b91f7 0%, #1d4ed8 100%);
            padding: 32px 24px;
            text-align: center;
          }
          
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          
          .logo-icon {
            width: 32px;
            height: 32px;
          }
          
          .logo-text { 
            font-size: 24px; 
            font-weight: 700; 
            color: #ffffff;
            margin: 0;
          }
          
          /* Test banner */
          .test-banner { 
            background: #fef3c7; 
            color: #92400e; 
            padding: 16px 24px; 
            text-align: center; 
            font-weight: 600;
            border-bottom: 1px solid #fcd34d;
          }
          
          /* Greeting section */
          .greeting { 
            padding: 32px 24px 24px;
            background: #f8faff;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .greeting h1 {
            margin: 0 0 12px 0;
            font-size: 28px;
            color: #1e293b;
            font-weight: 700;
          }
          
          .greeting p {
            margin: 0;
            font-size: 16px;
            color: #64748b;
          }
          
          /* Stats bar */
          .digest-stats {
            background: #f1f5f9;
            padding: 16px 24px;
            border-bottom: 1px solid #e2e8f0;
            text-align: center;
            color: #475569;
            font-size: 14px;
            font-weight: 500;
          }
          
          /* Empty state */
          .empty-state {
            padding: 48px 24px;
            text-align: center;
            color: #64748b;
          }
          
          .empty-state h3 {
            margin: 0 0 12px 0;
            color: #1e293b;
          }
          
          /* Content area */
          .content {
            padding: 24px;
          }
          
          /* Article cards */
          .article { 
            margin-bottom: 24px; 
            border: 1px solid #e2e8f0; 
            border-radius: 12px;
            background: #ffffff;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          
          .article:last-child {
            margin-bottom: 0;
          }
          
          .article-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
          }
          
          .article-content {
            padding: 20px;
          }
          
          .article h2 { 
            margin: 0 0 12px 0; 
            font-size: 18px;
            color: #1e293b;
            font-weight: 600;
            line-height: 1.4;
          }
          
          .article h2 a {
            color: #1e293b;
            text-decoration: none;
          }
          
          .article h2 a:hover {
            color: #2b91f7;
          }
          
          .article-summary {
            color: #475569;
            font-size: 15px;
            line-height: 1.5;
            margin: 0 0 16px 0;
          }
          
          /* Tags */
          .tags { 
            margin: 16px 0; 
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          
          .tag { 
            display: inline-block; 
            padding: 4px 12px; 
            background: #eff6ff; 
            color: #1e40af; 
            border-radius: 16px; 
            font-size: 12px;
            font-weight: 500;
            border: 1px solid #dbeafe;
          }
          
          .tag:nth-child(2n) {
            background: #f0fdf4;
            color: #166534;
            border-color: #dcfce7;
          }
          
          .tag:nth-child(3n) {
            background: #fef7ff;
            color: #86198f;
            border-color: #f3e8ff;
          }
          
          /* Article metadata */
          .article-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #94a3b8;
            font-size: 13px;
            padding-top: 12px;
            border-top: 1px solid #f1f5f9;
          }
          
          .meta-icon {
            width: 14px;
            height: 14px;
          }
          
          /* Footer */
          .footer { 
            background: #f8faff;
            text-align: center; 
            padding: 32px 24px; 
            border-top: 1px solid #e2e8f0; 
            color: #64748b; 
            font-size: 14px; 
          }
          
          .footer-brand {
            margin-bottom: 16px;
          }
          
          .footer-brand h3 {
            margin: 0 0 4px 0;
            font-size: 18px;
            color: #1e293b;
            font-weight: 600;
          }
          
          .footer-tagline {
            color: #64748b;
            margin: 0 0 16px 0;
          }
          
          .footer-tier {
            margin: 0 0 16px 0;
            padding: 8px 16px;
            background: #2b91f7;
            color: white;
            border-radius: 20px;
            display: inline-block;
            font-weight: 500;
            font-size: 13px;
          }
          
          .footer-links a {
            color: #64748b;
            text-decoration: none;
            font-weight: 500;
          }
          
          .footer-links a:hover {
            color: #2b91f7;
            text-decoration: underline;
          }
          
          /* Mobile responsive */
          @media (max-width: 480px) {
            .container {
              margin: 0;
            }
            
            .header {
              padding: 24px 16px;
            }
            
            .logo-text {
              font-size: 20px;
            }
            
            .greeting {
              padding: 24px 16px 16px;
            }
            
            .greeting h1 {
              font-size: 24px;
            }
            
            .content {
              padding: 16px;
            }
            
            .article-content {
              padding: 16px;
            }
            
            .article h2 {
              font-size: 16px;
            }
            
            .footer {
              padding: 24px 16px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${testMode ? '<div class="test-banner">🧪 TEST MODE - This is a test newsletter</div>' : ""}
          
          <!-- Header with Logo -->
          <div class="header">
            <div class="logo-container">
              <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.69L13.09 8.36L18.77 7.24L15.77 12L18.77 16.76L13.09 15.64L12 21.31L10.91 15.64L5.23 16.76L8.23 12L5.23 7.24L10.91 8.36L12 2.69Z" fill="white"/>
                <circle cx="12" cy="12" r="2" fill="#2b91f7"/>
                <circle cx="8" cy="8" r="1.5" fill="white" opacity="0.7"/>
                <circle cx="16" cy="16" r="1" fill="white" opacity="0.5"/>
              </svg>
              <h1 class="logo-text">DailyDrops</h1>
            </div>
          </div>

          <!-- Greeting -->
          <div class="greeting">
            <h1>Hi ${user.name}! 👋</h1>
            <p>Here's your personalized ${digest.cadence} digest${digest.items.length > 0 ? ` with ${digest.items.length} articles curated just for you.` : '.'}</p>
          </div>

          <!-- Stats -->
          <div class="digest-stats">
            📅 ${formatDate(digest.date)} • ${digest.slot} edition
          </div>

          <!-- Articles or Empty State -->
          ${digest.items.length > 0 ? renderArticles(digest.items) : renderEmptyState()}

          <!-- Footer -->
          <div class="footer">
            <div class="footer-brand">
              <h3>DailyDrops</h3>
              <p class="footer-tagline">Curated content for curious minds</p>
            </div>
            <div class="footer-tier">${user.subscription_tier.toUpperCase()} member</div>
            <div class="footer-links">
              <a href="${preferencesUrl || "#"}">Manage preferences</a> • 
              <a href="${unsubscribeUrl || "#"}">Unsubscribe</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function renderArticles(items: TransformedItem[]): string {
  return `
    <div class="content">
      ${items.map(renderArticle).join('')}
    </div>
  `;
}

function renderArticle(item: TransformedItem): string {
  return `
    <article class="article">
      ${item.image ? `<img src="${item.image}" alt="${item.title}" class="article-image" />` : ''}
      <div class="article-content">
        <h2><a href="${item.url}" target="_blank">${item.title}</a></h2>
        ${item.summary ? `<p class="article-summary">${item.summary}</p>` : ''}
        ${renderTags(item.tags)}
        ${item.showDate ? renderArticleMeta(item.date) : ''}
      </div>
    </article>
  `;
}

function renderTags(tags: string[]): string {
  if (!tags || tags.length === 0) return '';
  
  return `
    <div class="tags">
      ${tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
    </div>
  `;
}

function renderArticleMeta(date: Date | null): string {
  if (!date) return '';
  
  return `
    <div class="article-meta">
      <svg class="meta-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 2V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M3 10H21" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span>Published ${formatArticleDate(date)}</span>
    </div>
  `;
}

function renderEmptyState(): string {
  return `
    <div class="empty-state">
      <h3>No new content today</h3>
      <p>We couldn't find any new articles matching your preferences. Try expanding your topic selections or check back later!</p>
    </div>
  `;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatArticleDate(date: Date): string {
  try {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return '';
  }
}