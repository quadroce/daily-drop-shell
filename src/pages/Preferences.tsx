import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";

const Preferences = () => {
  const navigate = useNavigate();
  const { setFallbackPrefs, setFallbackActive } = usePreferences();
  const [selectedTopicIds, setSelectedTopicIds] = useState<bigint[]>([]);
  const [selectedLanguageIds, setSelectedLanguageIds] = useState<bigint[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Array<{id: bigint, label: string}>>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Array<{id: bigint, label: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Memoized validation state
  const isSaveEnabled = useMemo(() => {
    return selectedTopicIds.length >= 1 && selectedLanguageIds.length <= 3;
  }, [selectedTopicIds.length, selectedLanguageIds.length]);

  // Development logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Prefs] topics', selectedTopicIds, 'langs', selectedLanguageIds, 'isSaveEnabled', isSaveEnabled);
    }
  }, [selectedTopicIds, selectedLanguageIds, isSaveEnabled]);

  // Safety check for button accessibility in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && isSaveEnabled && saveButtonRef.current) {
      const btn = saveButtonRef.current;
      const computedStyle = getComputedStyle(btn);
      if (computedStyle.pointerEvents === 'none' || btn.tabIndex < 0) {
        console.warn('[Prefs] Save button blocked despite isSaveEnabled=true. Computed style:', {
          pointerEvents: computedStyle.pointerEvents,
          tabIndex: btn.tabIndex,
          disabled: btn.disabled
        });
      }
      
      // Check if button is clickable using elementFromPoint
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      
      if (elementAtPoint !== btn && !btn.contains(elementAtPoint)) {
        console.warn('[Prefs] Button is covered by another element:', elementAtPoint);
      }
    }
  }, [isSaveEnabled]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch topics and languages from database
        const [topicsResult, languagesResult] = await Promise.all([
          supabase.from('topics').select('id, label').order('label'),
          supabase.from('languages').select('id, label').order('label')
        ]);

        if (topicsResult.data) {
          setAvailableTopics(topicsResult.data.map(t => ({ id: BigInt(t.id), label: t.label })));
        }
        if (languagesResult.data) {
          setAvailableLanguages(languagesResult.data.map(l => ({ id: BigInt(l.id), label: l.label })));
        }

        // Fetch user's current preferences
        const { data: userPrefs } = await supabase
          .from('preferences')
          .select('selected_topic_ids, selected_language_ids')
          .single();

        if (userPrefs) {
          setSelectedTopicIds(userPrefs.selected_topic_ids.map((id: number) => BigInt(id)));
          setSelectedLanguageIds(userPrefs.selected_language_ids.map((id: number) => BigInt(id)));
        }
      } catch (error) {
        console.error('Error fetching preferences data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleTopic = (topicId: bigint) => {
    setSelectedTopicIds(prev => 
      prev.some(id => id === topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  const toggleLanguage = (languageId: bigint) => {
    if (selectedLanguageIds.some(id => id === languageId)) {
      setSelectedLanguageIds(prev => prev.filter(id => id !== languageId));
    } else if (selectedLanguageIds.length < 3) {
      setSelectedLanguageIds(prev => [...prev, languageId]);
    } else {
      // Prevent selection and show warning is handled in UI
      console.debug('[Prefs] Max 3 languages reached, blocking selection');
    }
  };

  const parseErrorMessage = (error: any): string => {
    if (error?.message) {
      // Parse common Supabase errors
      if (error.message.includes('RLS')) {
        return 'Permission denied. Please log in to save preferences.';
      }
      if (error.message.includes('function upsert_preferences') || error.message.includes('does not exist')) {
        return 'Database function not available. Using temporary preferences.';
      }
      if (error.message.includes('JWT')) {
        return 'Authentication error. Please log in again.';
      }
      return error.message;
    }
    return 'Unknown error occurred';
  };

  const handleSave = async () => {
    // Guard clause
    if (!isSaveEnabled) {
      console.debug('[Prefs] Save blocked - validation failed');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('upsert_preferences', {
        _topics: selectedTopicIds.map(id => Number(id)),
        _langs: selectedLanguageIds.map(id => Number(id))
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated successfully.",
      });

      navigate('/feed');
    } catch (error) {
      console.error('[upsert_preferences]', error);
      
      const errorMessage = parseErrorMessage(error);
      console.debug('[Prefs] Error details:', { error, message: errorMessage });

      // Activate fallback mode
      setFallbackPrefs({ selectedTopicIds, selectedLanguageIds });
      setFallbackActive(true);
      
      toast({
        title: "Using temporary preferences for this session",
        description: errorMessage,
        variant: "default",
      });

      // Still redirect to feed with fallback preferences
      navigate('/feed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading preferences...</div>
        </div>
      </div>
    );
  }

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
                    key={topic.id.toString()}
                    variant={selectedTopicIds.some(id => id === topic.id) ? "default" : "outline"}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      selectedTopicIds.some(id => id === topic.id)
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-secondary"
                    }`}
                    onClick={() => toggleTopic(topic.id)}
                  >
                    {selectedTopicIds.some(id => id === topic.id) && (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    {topic.label}
                  </Badge>
                ))}
              </div>
              
              {selectedTopicIds.length === 0 && (
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
                <span>Selected: {selectedLanguageIds.length}/3</span>
                {selectedLanguageIds.length >= 3 && (
                  <span className="text-warning">Max 3 languages</span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {availableLanguages.map((language) => (
                  <Badge
                    key={language.id.toString()}
                    variant={selectedLanguageIds.some(id => id === language.id) ? "default" : "outline"}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      selectedLanguageIds.some(id => id === language.id)
                        ? "bg-primary text-primary-foreground" 
                        : selectedLanguageIds.length >= 3 
                          ? "opacity-50 cursor-not-allowed" 
                          : "hover:bg-secondary"
                    }`}
                    onClick={() => toggleLanguage(language.id)}
                  >
                    {selectedLanguageIds.some(id => id === language.id) ? (
                      <X className="w-3 h-3 mr-1" />
                    ) : (
                      selectedLanguageIds.length < 3 && <Check className="w-3 h-3 mr-1" />
                    )}
                    {language.label}
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
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-muted-foreground">
            Topics: {selectedTopicIds.length} • Languages: {selectedLanguageIds.length}/3
          </div>
          <Button 
            ref={saveButtonRef}
            type="button"
            onClick={handleSave}
            disabled={!isSaveEnabled || saving}
            aria-disabled={!isSaveEnabled || saving}
            data-testid="save-preferences"
            className="min-w-32"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>

        {/* Empty State Helper */}
        {selectedTopicIds.length === 0 && (
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