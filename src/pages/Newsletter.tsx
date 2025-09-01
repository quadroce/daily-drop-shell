import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Mail, Clock, Info } from "lucide-react";

const Newsletter = () => {
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [deliveryTime, setDeliveryTime] = useState("09:00");

  // TODO: Connect to newsletter subscription settings in Supabase
  // TODO: Implement subscription toggle functionality

  const timeOptions = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Newsletter Settings</h1>
        <p className="text-muted-foreground">
          Manage your weekly DailyDrops newsletter subscription
        </p>
      </div>

      <div className="space-y-6">
        {/* Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Newsletter Subscription
            </CardTitle>
            <CardDescription>
              Get a weekly digest of your personalized drops delivered to your inbox
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="subscription-toggle" className="text-base font-medium">
                  Weekly Newsletter
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive curated content every week based on your preferences
                </p>
              </div>
              <Switch
                id="subscription-toggle"
                checked={isSubscribed}
                onCheckedChange={setIsSubscribed}
              />
            </div>
            
            {isSubscribed && (
              <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                <div className="flex items-center gap-2 text-success mb-2">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium">Subscribed</span>
                </div>
                <p className="text-sm text-success/80">
                  You'll receive your next newsletter on Sunday at {deliveryTime}
                </p>
              </div>
            )}
            
            {!isSubscribed && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium">Not Subscribed</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Turn on the newsletter to get weekly content summaries
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Delivery Preferences
            </CardTitle>
            <CardDescription>
              Choose when you'd like to receive your newsletter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-time">Preferred Delivery Time</Label>
              <Select 
                value={deliveryTime} 
                onValueChange={setDeliveryTime}
                disabled={!isSubscribed}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time} (CET)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Newsletter is sent every Sunday at your chosen time
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Newsletter Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Info className="h-5 w-5" />
              About the Newsletter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <p><strong>Content:</strong> Top picks from your weekly drops</p>
              <p><strong>Frequency:</strong> Once per week (Sundays)</p>
              <p><strong>Format:</strong> Clean, readable HTML with direct links</p>
              <p><strong>Personalization:</strong> Based on your topic preferences</p>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-accent rounded-lg mt-4">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-accent-foreground">Important Note</p>
                <p className="text-accent-foreground/80 mt-1">
                  Newsletter has no feedback buttons. Manage your content preferences and feedback through the web app.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button disabled className="min-w-32">
            Save Settings
          </Button>
        </div>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Newsletter Preview</CardTitle>
            <CardDescription>
              Here's what your weekly newsletter looks like
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-muted/30">
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-foreground">Your Weekly DailyDrops</h2>
                  <p className="text-sm text-muted-foreground">January 14, 2024</p>
                </div>
                
                <div className="space-y-3">
                  <div className="border-l-2 border-primary pl-4">
                    <h3 className="font-medium text-sm">The Future of AI in Content Discovery</h3>
                    <p className="text-xs text-muted-foreground">TechCrunch • AI, Technology</p>
                  </div>
                  <div className="border-l-2 border-primary pl-4">
                    <h3 className="font-medium text-sm">Building Scalable React Applications</h3>
                    <p className="text-xs text-muted-foreground">YouTube - Vercel • React, Development</p>
                  </div>
                  <div className="border-l-2 border-primary pl-4">
                    <h3 className="font-medium text-sm">Climate Tech Innovations in 2024</h3>
                    <p className="text-xs text-muted-foreground">Nature • Climate, Innovation</p>
                  </div>
                </div>
                
                <div className="text-center pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    That's all for this week! 📧
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Newsletter;