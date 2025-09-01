import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, User, CreditCard, Bell, Phone, Mail, Lock, Smartphone, Check } from "lucide-react";

const Settings = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");

  // TODO: Connect to user settings in Supabase
  // TODO: Implement WhatsApp verification
  // TODO: Connect to Stripe for billing management

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and security settings
        </p>
      </div>

      <div className="space-y-8">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Settings
            </CardTitle>
            <CardDescription>
              Update your personal information and security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value="john@example.com"
                    className="pl-10"
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email address
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value="John Doe"
                  disabled
                />
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password & Security
              </h4>
              <div className="space-y-3">
                <Button variant="outline" className="w-full md:w-auto" disabled>
                  Change Password
                </Button>
                <p className="text-xs text-muted-foreground">
                  Last changed: Never (signed up with Google)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing & Subscription
            </CardTitle>
            <CardDescription>
              Manage your subscription and payment methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Free Plan</Badge>
                  <span className="text-sm font-medium">Current Plan</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Daily drops, weekly newsletter
                </p>
              </div>
              <Button variant="outline" disabled>
                Manage Billing
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Billing Date</Label>
                <p className="text-sm text-muted-foreground">N/A (Free Plan)</p>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <p className="text-sm text-muted-foreground">None required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Control how you receive updates and alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="email-notifications" className="text-base font-medium">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive newsletter and account updates via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="push-notifications" className="text-base font-medium">
                    Push Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when new drops are available
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              WhatsApp Integration
            </CardTitle>
            <CardDescription>
              Set up WhatsApp delivery for Premium subscribers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-sm text-accent-foreground">
                WhatsApp delivery is available for Premium subscribers only
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp-number">WhatsApp Phone Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="whatsapp-number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="pl-10"
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Include country code (e.g., +1 for US, +44 for UK)
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled>
                  Verify Phone Number
                </Button>
                {whatsappNumber && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not Verified
                  </Badge>
                )}
              </div>
              
              <div className="p-3 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium mb-2">WhatsApp Delivery Schedule</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Morning Drop: 08:00 CET</p>
                  <p>• Evening Drop: 18:00 CET</p>
                  <p>• Timezone: Central European Time</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Changes */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled>
            Reset to Defaults
          </Button>
          <Button disabled>
            Save Changes
          </Button>
        </div>

        {/* Danger Zone */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              <div>
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="destructive" disabled>
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;