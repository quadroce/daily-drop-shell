import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Cookie, Settings } from "lucide-react";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowBanner(true);
    } else {
      const saved = JSON.parse(consent);
      setPreferences(saved);
    }
  }, []);

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    localStorage.setItem('cookie-consent', JSON.stringify(allAccepted));
    setPreferences(allAccepted);
    setShowBanner(false);
  };

  const acceptSelected = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    setShowBanner(false);
  };

  const rejectAll = () => {
    const necessary = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    localStorage.setItem('cookie-consent', JSON.stringify(necessary));
    setPreferences(necessary);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="bg-background/95 backdrop-blur-sm border-border shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Cookie className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-2">We use cookies</h3>
              <p className="text-xs text-muted-foreground mb-3">
                We use cookies to improve your experience, analyze site usage, and personalize content. 
                You can manage your preferences or learn more in our privacy policy.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  onClick={acceptAll}
                  className="text-xs"
                >
                  Accept All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={rejectAll}
                  className="text-xs"
                >
                  Reject All
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <Settings className="h-3 w-3 mr-1" />
                      Manage Preferences
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Cookie Preferences</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="necessary" 
                          checked={preferences.necessary}
                          disabled
                        />
                        <Label htmlFor="necessary" className="text-sm">
                          <div>
                            <div className="font-medium">Necessary</div>
                            <div className="text-xs text-muted-foreground">
                              Required for basic site functionality
                            </div>
                          </div>
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="analytics" 
                          checked={preferences.analytics}
                          onCheckedChange={(checked) => 
                            setPreferences(prev => ({ ...prev, analytics: !!checked }))
                          }
                        />
                        <Label htmlFor="analytics" className="text-sm">
                          <div>
                            <div className="font-medium">Analytics</div>
                            <div className="text-xs text-muted-foreground">
                              Help us understand how you use our site
                            </div>
                          </div>
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="marketing" 
                          checked={preferences.marketing}
                          onCheckedChange={(checked) => 
                            setPreferences(prev => ({ ...prev, marketing: !!checked }))
                          }
                        />
                        <Label htmlFor="marketing" className="text-sm">
                          <div>
                            <div className="font-medium">Marketing</div>
                            <div className="text-xs text-muted-foreground">
                              Personalized ads and content
                            </div>
                          </div>
                        </Label>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button onClick={acceptSelected} className="flex-1">
                          Save Preferences
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CookieConsent;