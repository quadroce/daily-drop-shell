# YouTube OAuth 2.0 Setup

This guide explains how to set up YouTube OAuth 2.0 for the auto-commenting feature.

## Prerequisites
- A Google Cloud project
- YouTube Data API v3 enabled

## Quick Setup (Recommended)

### Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **YouTube Data API v3**
4. Go to **APIs & Services** > **OAuth consent screen**:
   - Configure the consent screen
   - Add your domain to **Authorized domains** (if applicable)
   - Add the following scope:
     - `https://www.googleapis.com/auth/youtube.force-ssl`
   - Add yourself as a test user

5. Go to **APIs & Services** > **Credentials**
6. Click **Create Credentials** > **OAuth Client ID**
7. Choose **Web application**
8. Add **Authorized redirect URIs**:
   - For local testing: `http://localhost:8080`
   - For production: Your actual domain (if needed)

9. Save your **Client ID** and **Client Secret**

### Step 2: Generate Refresh Token

1. Open the file `docs/get-youtube-refresh-token.html` in your browser
2. Enter your Client ID and Client Secret
3. Click "Autorizza YouTube API"
4. Grant permissions to your YouTube account
5. Copy the authorization code from the redirect URL (it will be in the `?code=...` parameter)
6. Paste it in the form and click "Ottieni Refresh Token"
7. Copy the refresh token that appears

### Step 3: Configure Supabase Secrets

Add these three secrets in Supabase Dashboard under Settings > Edge Functions:
- `YOUTUBE_CLIENT_ID` - Your OAuth Client ID
- `YOUTUBE_CLIENT_SECRET` - Your OAuth Client Secret  
- `YOUTUBE_REFRESH_TOKEN` - The refresh token you just generated

### Step 4: Initialize the Token Cache

1. Go to `/admin` in your app
2. Find "YouTube OAuth Token Manager" panel
3. Click "Refresh Token Now"
4. Verify that the token is valid and has a future expiration time

## How It Works

1. **Cron Job**: Every 50 minutes, a cron job automatically refreshes the access token
2. **Token Cache**: The fresh access token is stored in `youtube_oauth_cache` table
3. **Auto-Comment**: When posting comments, the function uses the cached token
4. **Automatic Refresh**: If the token expires, it's automatically refreshed on the next scheduled run

## Important Notes

⚠️ **Critical**: Make sure the refresh token has the `youtube.force-ssl` scope, otherwise you'll get "Insufficient Permission" errors when trying to post comments.

✅ The token will be automatically refreshed every 50 minutes by a cron job.

✅ You can manually refresh the token anytime from the Admin panel.

## Troubleshooting

### Error: "Insufficient Permission" or "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
- Your refresh token doesn't have the correct scope
- Regenerate the refresh token using the HTML script and make sure to authorize with the `youtube.force-ssl` scope

### Error: "Invalid Credentials" or "Token expired"
- Click "Refresh Token Now" in the Admin panel
- If it fails, regenerate the refresh token (Step 2)

### Error: "Quota exceeded"
- YouTube API has daily quota limits
- Each comment costs ~50 quota units
- Default quota: 10,000 units/day = ~200 comments/day

## Security Notes

⚠️ **CRITICAL**:
- Never commit Client Secret or Refresh Token to git
- Always use Supabase secrets for sensitive credentials
- Monitor API usage to avoid quota violations
- The refresh token never expires unless revoked

## Testing

1. Go to `/admin` → Development Tools
2. Check "YouTube OAuth Token Manager" - token should be valid
3. Click "Run YouTube OAuth Test" - should post a test comment
4. Check the logs for any errors
