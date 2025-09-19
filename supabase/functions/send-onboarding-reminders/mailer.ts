import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface EmailData {
  email: string;
  firstName: string;
  preferredLang: string;
  attempt: number;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email templates as constants
const EMAIL_TEMPLATES = {
  en: {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete Your DailyDrop Onboarding</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        h1 {
            color: #1f2937;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .highlight {
            background-color: #f3f4f6;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: #2563eb;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .benefits {
            margin: 25px 0;
        }
        .benefit {
            margin: 10px 0;
            padding-left: 20px;
            position: relative;
        }
        .benefit:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #16a34a;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
        }
        .unsubscribe {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 20px;
        }
        .unsubscribe a {
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">DailyDrop</div>
            <p>Your daily AI, Tech & Business insights</p>
        </div>

        <h1>Hi {{first_name}},</h1>

        <p>You created a DailyDrop account but your onboarding is still pending.</p>
        
        <p><strong>Complete it now</strong> (it takes ~2 minutes) to start receiving your curated Daily Drop with the most relevant AI, Tech & Business insights.</p>

        <div class="highlight">
            <h3>What you get:</h3>
            <div class="benefits">
                <div class="benefit">5–10 high-signal items/day (articles & videos)</div>
                <div class="benefit">Always at least 1 YouTube highlight</div>
                <div class="benefit">Topics tailored to your interests</div>
            </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}" class="cta-button">
                👉 Finish onboarding
            </a>
        </div>

        <p>Don't miss out on staying ahead in the fast-moving world of AI and technology!</p>

        <div class="footer">
            <p>Best regards,<br>The DailyDrop Team</p>
            
            <div class="unsubscribe">
                <p>Don't want to receive these reminders? <a href="{{pause_link}}">Pause onboarding reminders</a></p>
            </div>
        </div>
    </div>
</body>
</html>`,
    txt: `DailyDrop - Complete Your Onboarding

Hi {{first_name}},

You created a DailyDrop account but your onboarding is still pending.

Complete it now (it takes ~2 minutes) to start receiving your curated Daily Drop with the most relevant AI, Tech & Business insights.

What you get:
✓ 5–10 high-signal items/day (articles & videos)
✓ Always at least 1 YouTube highlight
✓ Topics tailored to your interests

👉 Finish onboarding: {{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}

Don't miss out on staying ahead in the fast-moving world of AI and technology!

Best regards,
The DailyDrop Team

---
Don't want to receive these reminders? Pause onboarding reminders: {{pause_link}}`
  },
  it: {
    html: `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Completa la tua registrazione DailyDrop</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        h1 {
            color: #1f2937;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .highlight {
            background-color: #f3f4f6;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: #2563eb;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .benefits {
            margin: 25px 0;
        }
        .benefit {
            margin: 10px 0;
            padding-left: 20px;
            position: relative;
        }
        .benefit:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #16a34a;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
        }
        .unsubscribe {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 20px;
        }
        .unsubscribe a {
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">DailyDrop</div>
            <p>Le tue insights quotidiane su AI, Tech & Business</p>
        </div>

        <h1>Ciao {{first_name}},</h1>

        <p>Hai creato un account DailyDrop ma la registrazione è ancora in sospeso.</p>
        
        <p><strong>Completala ora</strong> (richiede ~2 minuti) per iniziare a ricevere il tuo Daily Drop curato con le insights più rilevanti su AI, Tech e Business.</p>

        <div class="highlight">
            <h3>Cosa ottieni:</h3>
            <div class="benefits">
                <div class="benefit">5–10 contenuti di alta qualità al giorno (articoli e video)</div>
                <div class="benefit">Sempre almeno 1 video YouTube in evidenza</div>
                <div class="benefit">Argomenti personalizzati sui tuoi interessi</div>
            </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}" class="cta-button">
                👉 Completa la registrazione
            </a>
        </div>

        <p>Non perdere l'opportunità di rimanere aggiornato nel mondo in rapida evoluzione dell'AI e della tecnologia!</p>

        <div class="footer">
            <p>Cordiali saluti,<br>Il team DailyDrop</p>
            
            <div class="unsubscribe">
                <p>Non vuoi ricevere questi promemoria? <a href="{{pause_link}}">Metti in pausa i promemoria</a></p>
            </div>
        </div>
    </div>
</body>
</html>`,
    txt: `DailyDrop - Completa la tua registrazione

Ciao {{first_name}},

Hai creato un account DailyDrop ma la registrazione è ancora in sospeso.

Completala ora (richiede ~2 minuti) per iniziare a ricevere il tuo Daily Drop curato con le insights più rilevanti su AI, Tech e Business.

Cosa ottieni:
✓ 5–10 contenuti di alta qualità al giorno (articoli e video)
✓ Sempre almeno 1 video YouTube in evidenza
✓ Argomenti personalizzati sui tuoi interessi

👉 Completa la registrazione: {{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}

Non perdere l'opportunità di rimanere aggiornato nel mondo in rapida evoluzione dell'AI e della tecnologia!

Cordiali saluti,
Il team DailyDrop

---
Non vuoi ricevere questi promemoria? Metti in pausa i promemoria: {{pause_link}}`
  }
};

function interpolateTemplate(template: string, data: {
  first_name: string;
  frontend_origin: string;
  attempt: string;
  pause_link: string;
}): string {
  return template
    .replace(/\{\{first_name\}\}/g, data.first_name)
    .replace(/\{\{frontend_origin\}\}/g, data.frontend_origin)
    .replace(/\{\{attempt\}\}/g, data.attempt)
    .replace(/\{\{pause_link\}\}/g, data.pause_link);
}

export async function sendOnboardingReminderEmail(emailData: EmailData): Promise<EmailResult> {
  try {
    const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') || 'https://dailydrops.cloud';
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'hello@dailydrops.cloud';
    
    // Prepare template variables
    const templateData = {
      first_name: emailData.firstName,
      frontend_origin: frontendOrigin,
      attempt: emailData.attempt.toString(),
      pause_link: `${frontendOrigin}/settings?pause=onboarding`
    };

    // Determine language (fallback to 'en' if not 'it')
    const lang = emailData.preferredLang === 'it' ? 'it' : 'en';
    
    // Get templates from constants
    const htmlTemplate = EMAIL_TEMPLATES[lang as keyof typeof EMAIL_TEMPLATES].html;
    const textTemplate = EMAIL_TEMPLATES[lang as keyof typeof EMAIL_TEMPLATES].txt;

    // Interpolate templates
    const htmlContent = interpolateTemplate(htmlTemplate, templateData);
    const textContent = interpolateTemplate(textTemplate, templateData);

    // Prepare email subject
    const subjects = {
      en: `Complete your DailyDrop onboarding - Attempt ${emailData.attempt}`,
      it: `Completa la tua registrazione DailyDrop - Tentativo ${emailData.attempt}`
    };

    const subject = subjects[lang as keyof typeof subjects] || subjects.en;

    // Prepare UTM link for tracking
    const ctaLink = `${frontendOrigin}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n${emailData.attempt}`;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [emailData.email],
      subject: subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'List-Unsubscribe': `<${templateData.pause_link}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    console.log(`✅ Email sent successfully to ${emailData.email}:`, emailResponse);

    return {
      success: true,
      messageId: emailResponse.data?.id
    };

  } catch (error) {
    console.error(`❌ Failed to send email to ${emailData.email}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown email error'
    };
  }
}