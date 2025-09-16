import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, AlertCircle, Loader2 } from "lucide-react";
import { fetchAvailableLanguages } from "@/lib/api/profile";

interface LanguagePreferencesProps {
  selectedLanguages: string[];
  onLanguageChange: (languages: string[]) => void;
}

export const LanguagePreferences: React.FC<LanguagePreferencesProps> = ({
  selectedLanguages,
  onLanguageChange
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
    let newLanguages = [...selectedLanguages];
    
    if (checked) {
      if (newLanguages.length < 3) {
        newLanguages.push(languageCode);
      }
    } else {
      newLanguages = newLanguages.filter(lang => lang !== languageCode);
    }
    
    onLanguageChange(newLanguages);
  };

  const canAddLanguage = selectedLanguages.length < 3;
  const hasMinLanguages = selectedLanguages.length >= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Language Preferences
        </CardTitle>
        <p className="text-muted-foreground">
          Select 1-3 languages you'd like to receive content in.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Languages</h3>
            <Badge variant="outline">
              {selectedLanguages.length}/3 selected
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
              const isSelected = selectedLanguages.includes(language.code);
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
      </CardContent>
    </Card>
  );
};