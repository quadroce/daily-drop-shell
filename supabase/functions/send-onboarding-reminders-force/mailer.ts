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
    <title>Complete Your DailyDrop Setup</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
        .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .cta-button:hover { background: #5a67d8; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .unsubscribe { margin-top: 20px; font-size: 11px; color: #999; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Complete Your DailyDrop Setup</h1>
        <p>Hi {{first_name}}, you're almost there!</p>
    </div>
    
    <div class="content">
        <p>This is reminder #{{attempt}} - we noticed you haven't finished setting up your DailyDrop account yet.</p>
        
        <p><strong>Why complete your setup?</strong></p>
        <ul>
            <li>🎯 Get personalized AI & tech content recommendations</li>
            <li>📧 Choose your preferred newsletter frequency</li>
            <li>🌐 Select your favorite topics and languages</li>
            <li>⚡ Access premium features and advanced filters</li>
        </ul>
        
        <p>It only takes 2 minutes to complete your onboarding and start receiving curated content that matches your interests.</p>
        
        <div style="text-align: center;">
            <a href="{{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}" class="cta-button">
                Complete Setup Now
            </a>
        </div>
        
        <p><small><strong>Having trouble?</strong> Reply to this email and our team will help you get started.</small></p>
    </div>
    
    <div class="footer">
        <p>DailyDrop - Your AI & Tech News Curator</p>
        <div class="unsubscribe">
            <p>Don't want to receive these reminders? <a href="{{pause_link}}">Pause onboarding reminders</a></p>
        </div>
    </div>
</body>
</html>`,
    txt: `🚀 Complete Your DailyDrop Setup

Hi {{first_name}}, you're almost there!

This is reminder #{{attempt}} - we noticed you haven't finished setting up your DailyDrop account yet.

Why complete your setup?
• 🎯 Get personalized AI & tech content recommendations
• 📧 Choose your preferred newsletter frequency  
• 🌐 Select your favorite topics and languages
• ⚡ Access premium features and advanced filters

It only takes 2 minutes to complete your onboarding and start receiving curated content that matches your interests.

👉 Complete Setup Now: {{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}

Having trouble? Reply to this email and our team will help you get started.

---
DailyDrop - Your AI & Tech News Curator

Don't want to receive these reminders? Pause onboarding reminders:
{{pause_link}}`
  },
  it: {
    html: `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Completa la Configurazione DailyDrop</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
        .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .cta-button:hover { background: #5a67d8; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .unsubscribe { margin-top: 20px; font-size: 11px; color: #999; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Completa la Configurazione DailyDrop</h1>
        <p>Ciao {{first_name}}, ci sei quasi!</p>
    </div>
    
    <div class="content">
        <p>Questo è il promemoria #{{attempt}} - abbiamo notato che non hai ancora completato la configurazione del tuo account DailyDrop.</p>
        
        <p><strong>Perché completare la configurazione?</strong></p>
        <ul>
            <li>🎯 Ricevi raccomandazioni personalizzate su AI e tecnologia</li>
            <li>📧 Scegli la frequenza preferita per la newsletter</li>
            <li>🌐 Seleziona i tuoi argomenti e lingue preferiti</li>
            <li>⚡ Accedi a funzionalità premium e filtri avanzati</li>
        </ul>
        
        <p>Bastano solo 2 minuti per completare l'onboarding e iniziare a ricevere contenuti curati che rispecchiano i tuoi interessi.</p>
        
        <div style="text-align: center;">
            <a href="{{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}" class="cta-button">
                Completa Configurazione
            </a>
        </div>
        
        <p><small><strong>Hai problemi?</strong> Rispondi a questa email e il nostro team ti aiuterà.</small></p>
    </div>
    
    <div class="footer">
        <p>DailyDrop - Il Tuo Curatore di Notizie AI & Tech</p>
        <div class="unsubscribe">
            <p>Non vuoi ricevere questi promemoria? <a href="{{pause_link}}">Metti in pausa i promemoria onboarding</a></p>
        </div>
    </div>
</body>
</html>`,
    txt: `🚀 Completa la Configurazione DailyDrop

Ciao {{first_name}}, ci sei quasi!

Questo è il promemoria #{{attempt}} - abbiamo notato che non hai ancora completato la configurazione del tuo account DailyDrop.

Perché completare la configurazione?
• 🎯 Ricevi raccomandazioni personalizzate su AI e tecnologia
• 📧 Scegli la frequenza preferita per la newsletter
• 🌐 Seleziona i tuoi argomenti e lingue preferiti
• ⚡ Accedi a funzionalità premium e filtri avanzati

Bastano solo 2 minuti per completare l'onboarding e iniziare a ricevere contenuti curati che rispecchiano i tuoi interessi.

👉 Completa Configurazione: {{frontend_origin}}/onboarding?utm_source=reminder&utm_medium=email&utm_campaign=onboarding_n{{attempt}}

Hai problemi? Rispondi a questa email e il nostro team ti aiuterà.

---
DailyDrop - Il Tuo Curatore di Notizie AI & Tech

Non vuoi ricevere questi promemoria? Metti in pausa i promemoria onboarding:
{{pause_link}}`
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
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'DailyDrop <onboarding@newsletter.dailydrops.cloud>';
    
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

    console.log(`✅ Email response for ${emailData.email}:`, {
      success: !emailResponse.error,
      messageId: emailResponse.data?.id,
      error: emailResponse.error
    });

    // Check if Resend returned an error
    if (emailResponse.error) {
      console.error(`❌ Resend API error for ${emailData.email}:`, emailResponse.error);
      return {
        success: false,
        error: `Resend error: ${emailResponse.error.message || JSON.stringify(emailResponse.error)}`
      };
    }

    // Only return success if no error from Resend
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