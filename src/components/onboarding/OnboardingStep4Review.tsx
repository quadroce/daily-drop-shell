import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, User, Globe, BookOpen, Youtube } from "lucide-react";
import { fetchAvailableLanguages } from "@/lib/api/profile";

interface OnboardingStep4Props {
  formData: {
    first_name: string;
    last_name: string;
    company_role: string;
    language_prefs: string[];
    youtube_embed_pref: boolean;
  };
  selectedTopics: number[];
  topicLabels: { [key: number]: string };
  onComplete: () => void;
  onBack: () => void;
  isCompleting: boolean;
}

export const OnboardingStep4Review: React.FC<OnboardingStep4Props> = ({
  formData,
  selectedTopics,
  topicLabels,
  onComplete,
  onBack,
  isCompleting
}) => {
  const [availableLanguages, setAvailableLanguages] = useState<{ code: string; label: string }[]>([]);

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const languages = await fetchAvailableLanguages();
        setAvailableLanguages(languages);
      } catch (error) {
        console.error('Failed to load languages:', error);
      }
    };

    loadLanguages();
  }, []);

  const getLanguageLabels = (codes: string[]) => {
    return codes.map(code => {
      const lang = availableLanguages.find(l => l.code === code);
      return lang?.label || code;
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Review Your Choices
        </CardTitle>
        <p className="text-muted-foreground">
          Please review your selections before completing the setup.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <h3 className="font-medium">Profile</h3>
          </div>
          <div className="pl-6 space-y-2">
            {formData.first_name || formData.last_name ? (
              <p>
                <span className="font-medium">Name:</span>{' '}
                {[formData.first_name, formData.last_name].filter(Boolean).join(' ')}
              </p>
            ) : (
              <p className="text-muted-foreground">No name provided</p>
            )}
            
            {formData.company_role ? (
              <p>
                <span className="font-medium">Role:</span> {formData.company_role}
              </p>
            ) : (
              <p className="text-muted-foreground">No role provided</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Languages Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <h3 className="font-medium">Languages</h3>
            <Badge variant="outline">
              {formData.language_prefs.length}/3
            </Badge>
          </div>
          <div className="pl-6">
            <div className="flex flex-wrap gap-2">
              {getLanguageLabels(formData.language_prefs).map((label, index) => (
                <Badge key={index} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* YouTube Preference */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-600" />
            <h3 className="font-medium">Video Preferences</h3>
          </div>
          <div className="pl-6">
            <p>
              <span className="font-medium">Inline YouTube embeds:</span>{' '}
              <Badge variant={formData.youtube_embed_pref ? "default" : "outline"}>
                {formData.youtube_embed_pref ? "Enabled" : "Disabled"}
              </Badge>
            </p>
            {formData.youtube_embed_pref && (
              <p className="text-sm text-muted-foreground mt-1">
                Premium feature - requires subscription for full access
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Topics Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <h3 className="font-medium">Topics</h3>
            <Badge variant="outline">
              {selectedTopics.length}/15
            </Badge>
          </div>
          <div className="pl-6">
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {selectedTopics.map((topicId) => (
                <Badge key={topicId} variant="secondary">
                  {topicLabels[topicId] || `Topic ${topicId}`}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack} disabled={isCompleting}>
            Back
          </Button>
          <Button onClick={onComplete} disabled={isCompleting}>
            {isCompleting ? "Completing..." : "Complete Setup"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};