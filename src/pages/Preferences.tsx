import React, { useState, useEffect } from "react";
import { TopicsOnboardingWizard } from "@/components/TopicsOnboardingWizard";
import { LanguagePreferences } from "@/components/preferences/LanguagePreferences";
import { YouTubePreferences } from "@/components/preferences/YouTubePreferences";
import { saveUserTopics, fetchUserPreferences } from "@/lib/api/topics";
import { getCurrentProfile, updateUserPreferences } from "@/lib/api/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Hash } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Preferences = () => {
  const [initialTopics, setInitialTopics] = useState<number[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [youtubeEmbedPref, setYoutubeEmbedPref] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadExistingPreferences = async () => {
      try {
        const [preferences, profile] = await Promise.all([
          fetchUserPreferences(),
          getCurrentProfile()
        ]);
        
        if (preferences) {
          setInitialTopics(preferences.selectedTopicIds);
          setSelectedTopics(preferences.selectedTopicIds);
        }
        
        if (profile) {
          setSelectedLanguages(profile.language_prefs || ['en']);
          setYoutubeEmbedPref(profile.youtube_embed_pref);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
        toast({
          title: "Error",
          description: "Failed to load preferences.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadExistingPreferences();
  }, []);

  const handleTopicsChange = async (topicIds: number[]) => {
    setSelectedTopics(topicIds);
  };

  const handleSaveAll = async () => {
    if (selectedLanguages.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least 1 language.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      // Save language and YouTube preferences
      await updateUserPreferences({
        language_prefs: selectedLanguages,
        youtube_embed_pref: youtubeEmbedPref,
      });

      // Save topics preferences
      await saveUserTopics(selectedTopics);
      
      toast({
        title: "Success",
        description: "All your preferences have been saved!",
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading preferences...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-8">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferences
          </CardTitle>
          <p className="text-muted-foreground">
            Customize your content preferences and settings.
          </p>
        </CardHeader>
      </Card>

      {/* Language and YouTube Preferences - Top Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <LanguagePreferences
          selectedLanguages={selectedLanguages}
          onLanguageChange={setSelectedLanguages}
        />
        
        <YouTubePreferences
          youtubeEmbedPref={youtubeEmbedPref}
          onYouTubeChange={setYoutubeEmbedPref}
        />
      </div>

      <Separator />

      {/* Topic Interests - Full Width Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Topic Interests
          </CardTitle>
          <p className="text-muted-foreground">
            Select topics you're interested in to personalize your feed.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <TopicsOnboardingWizard
            onSave={handleTopicsChange}
            initialSelectedTopics={initialTopics}
          />
        </CardContent>
      </Card>

      <Separator />
      
      {/* Save Button */}
      <div className="flex justify-center pb-8">
        <Button 
          onClick={handleSaveAll} 
          disabled={saving}
          size="lg"
          className="min-w-[200px]"
        >
          {saving ? "Saving..." : "Save All Preferences"}
        </Button>
      </div>
    </div>
  );
};

export default Preferences;