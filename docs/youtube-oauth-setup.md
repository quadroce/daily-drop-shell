# YouTube OAuth Setup for Auto-Comments

## Overview
Per postare commenti automatici su YouTube, devi configurare OAuth 2.0 con Google Cloud.

## Step 1: Google Cloud Console Setup

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita la **YouTube Data API v3**:
   - Menu → APIs & Services → Library
   - Cerca "YouTube Data API v3"
   - Clicca "Enable"

## Step 2: Configure OAuth Consent Screen

1. Menu → APIs & Services → OAuth consent screen
2. Scegli "External" come User Type
3. Compila i campi richiesti:
   - **App name**: DailyDrops Auto-Comment
   - **User support email**: il tuo email
   - **Developer contact**: il tuo email
4. Aggiungi gli scope necessari:
   - `.../auth/youtube.force-ssl` (View and manage your YouTube account)
5. Aggiungi test users (il tuo account YouTube)
6. Salva

## Step 3: Create OAuth Credentials

1. Menu → APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "DailyDrops YouTube Commenter"
5. Authorized redirect URIs:
   - `http://localhost:8000/callback` (per testing locale)
   - `https://qimelntuxquptqqynxzv.supabase.co/functions/v1/youtube-oauth-callback` (per production)

6. Ottieni le credenziali:
   - **Client ID**: Salvalo
   - **Client Secret**: Salvalo

## Step 4: Generate Access Token

### Opzione A: Script Locale (Consigliato per test)

Crea un file `get-youtube-token.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>YouTube OAuth Token</title>
</head>
<body>
    <h1>Get YouTube OAuth Token</h1>
    <button onclick="authorize()">Authorize</button>
    <div id="result"></div>
    
    <script>
        const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
        const REDIRECT_URI = 'http://localhost:8000/callback';
        const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
        
        function authorize() {
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
                `response_type=token&` +
                `scope=${encodeURIComponent(SCOPE)}`;
            
            window.location.href = authUrl;
        }
        
        // Parse token from URL after redirect
        window.onload = function() {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');
            
            if (token) {
                document.getElementById('result').innerHTML = `
                    <h2>Access Token:</h2>
                    <textarea style="width:100%;height:200px">${token}</textarea>
                    <p><strong>IMPORTANT:</strong> This token expires in 1 hour. For production, implement refresh token flow.</p>
                `;
            }
        };
    </script>
</body>
</html>
```

1. Sostituisci `YOUR_CLIENT_ID_HERE` con il tuo Client ID
2. Avvia un server locale: `python -m http.server 8000`
3. Apri `http://localhost:8000/get-youtube-token.html`
4. Click "Authorize" e fai login con il tuo account YouTube
5. Copia l'Access Token

### Opzione B: Refresh Token (Per Production)

Per uso continuato, devi implementare il refresh token flow. Questo richiede:
1. Exchange authorization code per access + refresh token
2. Store refresh token in Supabase secrets
3. Refresh automaticamente quando l'access token scade

## Step 5: Configure Supabase Secret

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard/project/qimelntuxquptqqynxzv/settings/functions)
2. Sotto "Edge Functions Secrets", aggiungi:
   - **Name**: `YOUTUBE_OAUTH_TOKEN`
   - **Value**: Il tuo access token

**IMPORTANTE**: L'access token scade dopo 1 ora. Per production, dovrai:
- Implementare refresh token flow
- Salvare refresh token come secret
- Creare un edge function che fa refresh automatico

## Step 6: Test

1. Vai su `/admin` → Development Tools → YT Comments
2. Click "Esegui Test"
3. Click "Aggiorna Dati" per vedere i risultati

Se il token è configurato correttamente, i job passeranno a status `posted` invece di `ready`.

## Troubleshooting

### Error: "YouTube OAuth token not configured"
- Il secret `YOUTUBE_OAUTH_TOKEN` non è configurato in Supabase
- Segui lo Step 5

### Error: "Invalid Credentials"
- Il token è scaduto (durata: 1 ora)
- Genera un nuovo token seguendo Step 4

### Error: "Insufficient Permission"
- Lo scope OAuth è sbagliato
- Assicurati di usare `youtube.force-ssl` scope

### Error: "The request uses the 'commentThreads' quota"
- Hai raggiunto il quota limit di YouTube API
- Default: 10,000 units/day
- Ogni comment insert costa ~50 units = ~200 commenti/giorno max

## Production Setup

Per deployment in production, devi:

1. **Implementare Refresh Token Flow**:
   - Crea edge function `youtube-oauth-refresh`
   - Store refresh token in Supabase secrets
   - Auto-refresh access token quando scade

2. **Monitoring**:
   - Log tutti i post tentativi
   - Alert quando quota è vicino al limite
   - Track success/error rates

3. **Rate Limiting**:
   - Rispetta YouTube API quota
   - Implementa exponential backoff per errori
   - Considera spreading comments durante la giornata

## Security Notes

⚠️ **CRITICAL**:
- NON committare mai Client Secret nel codice
- NON esporre mai Access Token nel frontend
- Usa sempre Supabase secrets per token
- Monitora l'uso del quota per evitare bans
- Considera implementare webhook per notifiche di errori

## Next Steps

Una volta configurato OAuth, puoi:
1. Testare con pochi video
2. Monitorare i risultati in `social_comment_events`
3. Aggiustare i template e prompts AI se necessario
4. Aumentare gradualmente il volume
5. Implementare analytics per tracciare conversioni

## Resources

- [YouTube Data API Docs](https://developers.google.com/youtube/v3/docs)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
