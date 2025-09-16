import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Youtube, AlertCircle, Loader2 } from "lucide-react";
import { fetchAvailableLanguages } from "@/lib/api/profile";

interface OnboardingStep2Props {
  formData: {
    language_prefs: string[];
    youtube_embed_pref: boolean;
  };
  onChange: (field: string, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingStep2Preferences: React.FC<OnboardingStep2Props> = ({
  formData,
  onChange,
  onNext,
  onBack
}) => {
  const [availableLanguages, setAvailableLanguages] = useState<{ code: string; label: string }[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(true);

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const languages = await fetchAvailableLanguages();
        setAvailableLanguages(languages);
      } catch (error) {
        console.error('Failed to load languages:', error);
      } finally {
        setLoadingLanguages(false);
      }
    };

    loadLanguages();
  }, []);
  const handleLanguageToggle = (languageCode: string, checked: boolean) => {
    let newLanguages = [...formData.language_prefs];
    
    if (checked) {
      if (newLanguages.length < 3) {
        newLanguages.push(languageCode);
      }
    } else {
      newLanguages = newLanguages.filter(lang => lang !== languageCode);
    }
    
    onChange('language_prefs', newLanguages);
  };

  const canAddLanguage = formData.language_prefs.length < 3;
  const hasMinLanguages = formData.language_prefs.length >= 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMinLanguages) {
      return;
    }
    onNext();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Content Preferences
        </CardTitle>
        <p className="text-muted-foreground">
          Select 1-3 languages you'd like to receive content in.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Languages</h3>
              <Badge variant="outline">
                {formData.language_prefs.length}/3 selected
              </Badge>
            </div>
            
            {!hasMinLanguages && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">Please select at least 1 language</p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {loadingLanguages ? (
                <div className="col-span-full flex items-center justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading languages...</span>
                </div>
              ) : availableLanguages.length === 0 ? (
                <div className="col-span-full text-center p-6 text-muted-foreground">
                  No languages available
                </div>
              ) : (
                availableLanguages.map((language) => {
                const isSelected = formData.language_prefs.includes(language.code);
                const isDisabled = !isSelected && !canAddLanguage;
                
                return (
                  <div
                    key={language.code}
                    className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/20' 
                        : isDisabled 
                          ? 'bg-muted/50 border-muted cursor-not-allowed'
                          : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={language.code}
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={(checked) => 
                        handleLanguageToggle(language.code, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={language.code}
                      className={`flex-1 cursor-pointer ${isDisabled ? 'text-muted-foreground' : ''}`}
                    >
                      {language.label}
                    </Label>
                  </div>
                );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <Youtube className="h-5 w-5 mt-0.5 text-red-600" />
                <div>
                  <h4 className="font-medium">YouTube Video Embeds</h4>
                  <p className="text-sm text-muted-foreground">
                    Show YouTube videos inline in your feed (Premium feature)
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.youtube_embed_pref}
                onCheckedChange={(checked) => onChange('youtube_embed_pref', checked)}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" disabled={!hasMinLanguages}>
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};