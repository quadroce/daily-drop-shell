// src/pages/Preferences.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopicsOnboardingWizard } from "@/components/TopicsOnboardingWizard";
import { LanguagePreferences } from "@/components/preferences/LanguagePreferences";
import { YouTubePreferences } from "@/components/preferences/YouTubePreferences";
import { getCurrentProfile } from "@/lib/api/profile";
import {
  fetchAllUserPreferences,
  saveAllUserPreferences,
} from "@/lib/api/preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Hash, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Preferences: React.FC = () => {
  const navigate = useNavigate();

  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>(
    [],
  );
  const [youtubeEmbedPref, setYoutubeEmbedPref] = useState<boolean>(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carica preferenze correnti (topics + lingue + youtube) all'apertura
  useEffect(() => {
    const load = async () => {
      try {
        const [{ selectedTopicIds, languageCodes }, profile] = await Promise
          .all([
            fetchAllUserPreferences(),
            getCurrentProfile(),
          ]);

        setSelectedTopics(selectedTopicIds ?? []);
        setSelectedLanguageCodes(languageCodes ?? ["en"]);
        setYoutubeEmbedPref(Boolean(profile?.youtube_embed_pref ?? true));
      } catch (err) {
        console.error("Error loading preferences", err);
        toast({
          title: "Failed to load preferences",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // === SUBMIT HANDLER ===
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1) assicurati che la sessione esista
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("You must be logged in");

      // 2) salva tutte le preferenze (usa la tua API consolidata)
      await saveAllUserPreferences({
        languages: selectedLanguageCodes,
        topicIds: selectedTopics,
      });

      // 3) aggiorna anche flag youtube (su profiles)
      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          youtube_embed_pref: youtubeEmbedPref,
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (upErr) throw upErr;

      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated.",
      });

      // 4) redirect solo al successo
      navigate("/feed", { replace: true });
    } catch (err) {
      console.error("Saving preferences failed", err);
      toast({
        title: "Failed to save preferences",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Loading preferences...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* LINGUE + YOUTUBE */}
          <div className="grid md:grid-cols-2 gap-6">
            <LanguagePreferences
              selectedLanguages={selectedLanguageCodes}
              onChange={setSelectedLanguageCodes}
            />
            <YouTubePreferences
              value={youtubeEmbedPref}
              onChange={setYoutubeEmbedPref}
            />
          </div>

          <Separator />

          {/* TOPICS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Topics</h3>
            </div>
            <TopicsOnboardingWizard
              selectedTopics={selectedTopics}
              onChangeSelected={setSelectedTopics}
            />
          </div>

          <div className="flex justify-center pt-6">
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              size="lg"
              className="min-w-[200px]"
            >
              {saving ? "Saving..." : "Save All Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Preferences;
