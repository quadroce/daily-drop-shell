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

// Load email templates
async function loadTemplate(lang: string, format: 'html' | 'txt'): Promise<string> {
  try {
    const templatePath = new URL(`./templates/onboarding_reminder_${lang}.${format}`, import.meta.url);
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Failed to load template ${lang}.${format}:`, error);
    // Fallback to English if preferred language template fails
    if (lang !== 'en') {
      return loadTemplate('en', format);
    }
    throw error;
  }
}

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
    
    // Load templates
    const htmlTemplate = await loadTemplate(lang, 'html');
    const textTemplate = await loadTemplate(lang, 'txt');

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