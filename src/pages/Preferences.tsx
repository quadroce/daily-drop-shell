import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, X } from "lucide-react";

const Preferences = () => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["Technology", "AI"]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["English"]);

  // TODO: Connect to user preferences in Supabase
  // TODO: Implement preference saving functionality

  const availableTopics = [
    "Technology", "AI", "Science", "Business", "Design", "Programming", 
    "Marketing", "Finance", "Health", "Politics", "Climate", "Education",
    "Psychology", "Philosophy", "Art", "Music", "Gaming", "Sports"
  ];

  const availableLanguages = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese",
    "Dutch", "Russian", "Chinese", "Japanese", "Korean", "Arabic"
  ];

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const toggleLanguage = (language: string) => {
    if (selectedLanguages.includes(language)) {
      setSelectedLanguages(prev => prev.filter(l => l !== language));
    } else if (selectedLanguages.length < 3) {
      setSelectedLanguages(prev => [...prev, language]);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Preferences</h1>
        <p className="text-muted-foreground">Customize your DailyDrops experience</p>
      </div>

      <div className="space-y-8">
        {/* Topics Section */}
        <Card>
          <CardHeader>
            <CardTitle>Interests & Topics</CardTitle>
            <CardDescription>
              Select topics you're interested in. These will help personalize your daily drops.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant={selectedTopics.includes(topic) ? "default" : "outline"}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      selectedTopics.includes(topic) 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-secondary"
                    }`}
                    onClick={() => toggleTopic(topic)}
                  >
                    {selectedTopics.includes(topic) && (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    {topic}
                  </Badge>
                ))}
              </div>
              
              {selectedTopics.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <p className="text-sm text-accent-foreground">
                    Select at least one topic to get personalized content
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Languages Section */}
        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              Choose up to 3 languages for your content. Content will be prioritized in your selected languages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Selected: {selectedLanguages.length}/3</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {availableLanguages.map((language) => (
                  <Badge
                    key={language}
                    variant={selectedLanguages.includes(language) ? "default" : "outline"}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      selectedLanguages.includes(language) 
                        ? "bg-primary text-primary-foreground" 
                        : selectedLanguages.length >= 3 
                          ? "opacity-50 cursor-not-allowed" 
                          : "hover:bg-secondary"
                    }`}
                    onClick={() => toggleLanguage(language)}
                  >
                    {selectedLanguages.includes(language) ? (
                      <X className="w-3 h-3 mr-1" />
                    ) : (
                      selectedLanguages.length < 3 && <Check className="w-3 h-3 mr-1" />
                    )}
                    {language}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Frequency Section */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Frequency</CardTitle>
            <CardDescription>
              Configure how often you receive your drops
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="web-frequency">Web App</Label>
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Daily (Free Plan)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newsletter-frequency">Newsletter</Label>
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Weekly (Free Plan)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  <strong>Free Plan:</strong> Daily web drops, weekly newsletter. 
                  <span className="text-primary"> Upgrade to Premium</span> for more frequency options and WhatsApp delivery.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button disabled className="min-w-32">
            Save Preferences
          </Button>
        </div>

        {/* Empty State Helper */}
        {selectedTopics.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="text-center py-8">
              <div className="text-muted-foreground space-y-2">
                <p>👆 Select some topics above to get started</p>
                <p className="text-sm">Your personalized drops will appear based on your preferences</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Preferences;