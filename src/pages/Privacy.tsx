import { Seo } from "@/components/Seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Database, Lock, Eye, Clock, Gavel, Cookie, Settings } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo 
        title="Privacy Policy - DropDaily"
        description="Learn how DropDaily collects, uses, and protects your personal data. Our comprehensive privacy policy covers data collection, usage, sharing, and your rights under GDPR."
        canonical={`${window.location.origin}/privacy`}
      />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: [insert date]</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                1. Who We Are
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>DropDaily is a content curation platform that delivers a daily selection ("Daily Drop") of high-signal articles, videos, and other media.</p>
              <div>
                <p className="font-semibold">Data Controller:</p>
                <p>dailydrops.cloud</p>
                <p>Contact email: privacy@dailydrops.cloud</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                2. Data We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold mb-2">Registration data:</p>
                <p>email, phone number (if provided), name (if provided), login provider (Google, LinkedIn, or email/password).</p>
              </div>
              <div>
                <p className="font-semibold mb-2">Preferences:</p>
                <p>selected interests and languages.</p>
              </div>
              <div>
                <p className="font-semibold mb-2">Technical data:</p>
                <p>access logs, IP address, device/browser type.</p>
              </div>
              <div>
                <p className="font-semibold mb-2">Usage data:</p>
                <p>interactions with content (clicks, likes, dislikes, saves, time on page, video plays).</p>
              </div>
              <div>
                <p className="font-semibold mb-2">Payment data (Premium only):</p>
                <p>processed securely via Stripe, not stored on our servers.</p>
              </div>
              <div>
                <p className="font-semibold mb-2">External channel data:</p>
                <p>if you activate Telegram, WhatsApp, or other channels, we store the necessary ID to deliver content.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                3. How We Use Your Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside">
                <li>To provide the service (personalized feed, newsletter, notifications).</li>
                <li>To improve personalization through machine learning.</li>
                <li>To ensure security and prevent abuse.</li>
                <li>To comply with legal and billing obligations.</li>
                <li>To generate anonymous statistics and measure platform usage.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                4. Legal Basis (GDPR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong>Contract performance:</strong> to deliver the service you signed up for.</li>
                <li><strong>Consent:</strong> for newsletter delivery, push/WhatsApp notifications, and analytics cookies.</li>
                <li><strong>Legal obligations:</strong> billing and tax record retention.</li>
                <li><strong>Legitimate interest:</strong> improving services, preventing fraud or misuse.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                5. Data Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Your data may be shared with:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong>Technical providers:</strong> Supabase (database + authentication), Vercel/Render (frontend hosting), OpenAI (content embeddings only, never personal data), Google Analytics (aggregated metrics).</li>
                <li><strong>Payment services:</strong> Stripe.</li>
                <li><strong>Messaging services:</strong> WhatsApp (Meta), Telegram, Discord (only if activated by you).</li>
                <li><strong>Authorities:</strong> if legally required.</li>
              </ul>
              <p className="font-semibold mt-4">We never sell your data to third parties.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                6. Data Retention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong>Account and preferences:</strong> as long as your account is active.</li>
                <li><strong>Interaction data:</strong> stored for up to 24 months, then anonymized.</li>
                <li><strong>Billing records:</strong> stored for 10 years, as required by tax law.</li>
              </ul>
              <p className="mt-4">You may delete your account at any time.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                7. Your Rights (GDPR)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>You have the right to:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Access your personal data.</li>
                <li>Request correction or deletion.</li>
                <li>Withdraw consent (e.g., newsletters, notifications).</li>
                <li>Request data portability.</li>
                <li>File a complaint with your Data Protection Authority.</li>
              </ul>
              <p className="font-semibold mt-4">To exercise your rights, contact: [privacy email].</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cookie className="h-5 w-5" />
                8. Cookies and Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong>Essential cookies:</strong> required for login and security.</li>
                <li><strong>Analytics cookies:</strong> Google Analytics 4 (anonymized, only with consent).</li>
                <li><strong>Marketing cookies:</strong> none – we do not use third-party advertising cookies.</li>
              </ul>
              <p className="mt-4">A cookie banner will be displayed at first visit to collect consent.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                9. Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside">
                <li>Supabase provides encryption at rest and in transit.</li>
                <li>Access is restricted to authorized personnel.</li>
                <li>Optional multi-factor authentication (MFA) available for Premium/Corporate users.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                10. Changes to This Privacy Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>We may update this Privacy Policy from time to time. If changes are significant, we will notify users by email or in-app message.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Privacy;