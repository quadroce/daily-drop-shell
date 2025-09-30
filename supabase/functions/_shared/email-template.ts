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
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}

export function renderTemplate(content: DigestContent): string {
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
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fbfcff;">
          <tr>
            <td align="center" style="padding:0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="max-width:600px; background:#ffffff; margin:0 auto;">
                ${
    testMode
      ? `
                <tr>
                  <td style="background:#fef3c7; color:#92400e; padding:16px 24px; text-align:center; font-weight:600; border-bottom:1px solid #fcd34d;">
                    🧪 TEST MODE - This is a test newsletter
                  </td>
                </tr>
                `
      : ""
  }
                
                <!-- White Header with Logo -->
                <tr>
                  <td align="center" style="background:#ffffff; padding:24px 0 20px 0;">
                    <img src="https://dailydrops.cloud/email/dailydrops-logo.png" 
                         width="120" 
                         height="auto" 
                         alt="DailyDrops" 
                         style="display:block; border:0; outline:none; text-decoration:none; height:auto; line-height:100%;">
                  </td>
                </tr>

                ${
    user.name
      ? `
                <!-- Greeting (only if name exists) -->
                <tr>
                  <td style="background:#ffffff; padding:0 24px 8px 24px;">
                    <h1 style="margin:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:24px; line-height:1.3; color:#111827; font-weight:700;">
                      Hi ${user.name}! 👋
                    </h1>
                  </td>
                </tr>
                `
      : ""
  }
                
                <!-- Subtitle -->
                <tr>
                  <td style="background:#ffffff; padding:${
    user.name ? "8px" : "0"
  } 24px 24px 24px;">
                    <p style="margin:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:16px; color:#64748b;">
                      Here's your personalized ${digest.cadence} digest with ${digest.items.length} articles curated just for you.
                    </p>
                  </td>
                </tr>

                <!-- Stats -->
                <tr>
                  <td style="background:#f1f5f9; padding:16px 24px; border-bottom:1px solid #e2e8f0; text-align:center; color:#475569; font-size:14px; font-weight:500; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                    📅 ${
    new Date(digest.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } • ${digest.slot} edition
                  </td>
                </tr>

                <!-- Articles -->
                <tr>
                  <td style="padding:24px;">
                    ${
    digest.items.map((item, index) => `
                      <div style="margin-bottom:24px; border:1px solid #e2e8f0; border-radius:12px; background:#ffffff; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        ${
      item.image_url
        ? `
                          <img src="${item.image_url}" alt="${item.title}" style="width:100%; height:200px; object-fit:cover; display:block;" />
                        `
        : ""
    }
                        <div style="padding:20px;">
                          <h2 style="margin:0 0 12px 0; font-size:18px; color:#1e293b; font-weight:600; line-height:1.4; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                            <a href="${item.url}" target="_blank" style="color:#1e293b; text-decoration:none;">${item.title}</a>
                          </h2>
                          ${
      item.summary
        ? `<p style="color:#475569; font-size:15px; line-height:1.5; margin:0 0 16px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${item.summary}</p>`
        : ""
    }
                          ${
      item.tags && item.tags.length > 0
        ? `
                            <div style="margin:16px 0; display:flex; flex-wrap:wrap; gap:6px;">
                              ${
          item.tags
            .map(
              (tag) =>
                `<span style="display:inline-block; padding:4px 12px; background:#eff6ff; color:#1e40af; border-radius:16px; font-size:12px; font-weight:500; border:1px solid #dbeafe;">#${tag}</span>`
            )
            .join("")
        }
                            </div>
                          `
        : ""
    }
                          <div style="display:flex; align-items:center; gap:8px; color:#94a3b8; font-size:13px; padding-top:12px; border-top:1px solid #f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                            <span>Published ${
      new Date(item.published_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }</span>
                          </div>
                        </div>
                      </div>
                    `).join("")
  }
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8faff; text-align:center; padding:32px 24px; border-top:1px solid #e2e8f0; color:#64748b; font-size:14px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                    <div style="margin-bottom:16px;">
                      <h3 style="margin:0 0 4px 0; font-size:18px; color:#1e293b; font-weight:600;">DailyDrops</h3>
                      <p style="color:#64748b; margin:0 0 16px 0;">Curated content for curious minds</p>
                    </div>
                    <div style="margin:0 0 16px 0; padding:8px 16px; background:#2b91f7; color:white; border-radius:20px; display:inline-block; font-weight:500; font-size:13px;">
                      ${user.subscription_tier.toUpperCase()} member
                    </div>
                    <div>
                      <a href="${
    preferencesUrl || "#"
  }" style="color:#64748b; text-decoration:none; font-weight:500;">Manage preferences</a> • 
                      <a href="${
    unsubscribeUrl || "#"
  }" style="color:#64748b; text-decoration:none; font-weight:500;">Unsubscribe</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
