interface DigestContent {
  user: {
    name: string;
    email: string;
    subscription_tier: string;
  };
  digest: {
    cadence: string;
    slot: string;
    date: string;
    items: Array<{
      title: string;
      summary: string;
      url: string;
      image_url?: string;
      published_at: string;
      tags: string[];
    }>;
  };
  testMode?: boolean;
}

export function renderTemplate(content: DigestContent): string {
  const { user, digest, testMode } = content;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your ${digest.cadence} digest</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #1a1a1a; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background: #ffffff;
          }
          .header { 
            text-align: center; 
            padding: 30px 0; 
            border-bottom: 2px solid #f1f5f9;  
          }
          .logo { 
            font-size: 28px; 
            font-weight: 700; 
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .greeting { 
            margin: 30px 0; 
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
          }
          .greeting h2 {
            margin: 0 0 10px 0;
            font-size: 22px;
            color: #1e293b;
          }
          .article { 
            margin: 25px 0; 
            padding: 24px; 
            border: 1px solid #e2e8f0; 
            border-radius: 12px;
            background: #ffffff;
            transition: box-shadow 0.2s ease;
          }
          .article:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .article h3 { 
            margin: 0 0 12px 0; 
            font-size: 18px;
            color: #1e293b;
            font-weight: 600;
          }
          .article h3 a {
            color: #1e293b;
            text-decoration: none;
          }
          .article h3 a:hover {
            color: #2563eb;
            text-decoration: underline;
          }
          .article p { 
            margin: 8px 0; 
            color: #64748b;
            font-size: 14px;
          }
          .article-summary {
            color: #475569;
            font-size: 15px;
            line-height: 1.5;
          }
          .tags { 
            margin: 15px 0 10px 0; 
          }
          .tag { 
            display: inline-block; 
            padding: 4px 10px; 
            margin: 2px 4px 2px 0; 
            background: #e0f2fe; 
            color: #0c4a6e; 
            border-radius: 16px; 
            font-size: 12px;
            font-weight: 500;
          }
          .meta {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #f1f5f9;
          }
          .footer { 
            text-align: center; 
            padding: 30px 0; 
            border-top: 1px solid #e2e8f0; 
            margin-top: 40px; 
            color: #64748b; 
            font-size: 14px; 
          }
          .footer a {
            color: #64748b;
            text-decoration: none;
          }
          .footer a:hover {
            color: #2563eb;
            text-decoration: underline;
          }
          .test-banner { 
            background: #fef3c7; 
            color: #92400e; 
            padding: 12px; 
            text-align: center; 
            margin-bottom: 20px; 
            border-radius: 8px;
            font-weight: 600;
          }
          .digest-stats {
            background: #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
            color: #475569;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        ${testMode ? '<div class="test-banner">🧪 TEST MODE - This is a test newsletter</div>' : ''}
        
        <div class="header">
          <div class="logo">📰 DailyDrops</div>
        </div>

        <div class="greeting">
          <h2>Hi ${user.name}! 👋</h2>
          <p>Here's your personalized ${digest.cadence} digest with ${digest.items.length} handpicked articles.</p>
        </div>

        <div class="digest-stats">
          📅 ${new Date(digest.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} • ${digest.slot} edition
        </div>

        ${digest.items.map((item, index) => `
          <div class="article">
            <h3><a href="${item.url}" target="_blank">${item.title}</a></h3>
            ${item.summary ? `<p class="article-summary">${item.summary}</p>` : ''}
            ${item.tags && item.tags.length > 0 ? `
              <div class="tags">
                ${item.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
              </div>
            ` : ''}
            <div class="meta">
              📰 Published ${new Date(item.published_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
        `).join('')}

        <div class="footer">
          <p><strong>DailyDrops</strong> - Curated content for curious minds</p>
          <p>You're subscribed as a <strong>${user.subscription_tier}</strong> member</p>
          <p>
            <a href="#" style="color: #64748b;">Manage preferences</a> • 
            <a href="#" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>
  `;
}