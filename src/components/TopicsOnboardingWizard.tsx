import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Search, ChevronLeft, ChevronRight, X, ArrowRight } from "lucide-react";
import { fetchTopicsTree } from "@/lib/api/topics";
import { trackOnboardingStart, trackPreferencesCompleted } from "@/lib/trackers/onboarding";
import { TopicCard } from "@/components/TopicCard";

interface Topic {
  id: number;
  slug: string;
  label: string;
  level: 1 | 2 | 3;
  parent_id: number | null;
}

interface TopicsOnboardingWizardProps {
  onSave: (topicIds: number[]) => Promise<void>;
  onSaveAll?: () => Promise<void>;
  initialSelectedTopics?: number[];
}

// Fallback seed data
const SEED_TOPICS: Topic[] = [
  // Macro topics (level 1)
  { id: 1, slug: "technology", label: "Technology", level: 1, parent_id: null },
  { id: 2, slug: "business", label: "Business", level: 1, parent_id: null },
  { id: 3, slug: "science", label: "Science", level: 1, parent_id: null },
  { id: 4, slug: "health", label: "Health", level: 1, parent_id: null },
  { id: 20, slug: "sports", label: "Sports", level: 1, parent_id: null },
  { id: 21, slug: "entertainment", label: "Entertainment", level: 1, parent_id: null },
  
  // Sub topics (level 2)
  { id: 5, slug: "ai-ml", label: "AI & Machine Learning", level: 2, parent_id: 1 },
  { id: 6, slug: "web-dev", label: "Web Development", level: 2, parent_id: 1 },
  { id: 7, slug: "fintech", label: "FinTech", level: 2, parent_id: 2 },
  { id: 8, slug: "biotech", label: "Biotechnology", level: 2, parent_id: 3 },
  { id: 13, slug: "nutrition", label: "Nutrition", level: 2, parent_id: 4 },
  { id: 14, slug: "fitness", label: "Fitness", level: 2, parent_id: 4 },
  { id: 15, slug: "mental-health", label: "Mental Health", level: 2, parent_id: 4 },
  { id: 16, slug: "football", label: "Football", level: 2, parent_id: 20 },
  { id: 17, slug: "basketball", label: "Basketball", level: 2, parent_id: 20 },
  { id: 18, slug: "movies", label: "Movies", level: 2, parent_id: 21 },
  { id: 19, slug: "music", label: "Music", level: 2, parent_id: 21 },
  
  // Micro topics (level 3)
  { id: 9, slug: "chatgpt", label: "ChatGPT", level: 3, parent_id: 5 },
  { id: 10, slug: "react", label: "React", level: 3, parent_id: 6 },
  { id: 11, slug: "crypto", label: "Cryptocurrency", level: 3, parent_id: 7 },
  { id: 12, slug: "gene-therapy", label: "Gene Therapy", level: 3, parent_id: 8 },
  { id: 22, slug: "supplements", label: "Supplements", level: 3, parent_id: 13 },
  { id: 23, slug: "meditation", label: "Meditation", level: 3, parent_id: 15 },
  { id: 24, slug: "nba", label: "NBA", level: 3, parent_id: 17 },
  { id: 25, slug: "netflix", label: "Netflix", level: 3, parent_id: 18 },
];

export const TopicsOnboardingWizard: React.FC<TopicsOnboardingWizardProps> = ({
  onSave,
  onSaveAll,
  initialSelectedTopics = []
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set(initialSelectedTopics));
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track onboarding start
  useEffect(() => {
    trackOnboardingStart();
  }, []);

  // Sync selected topics when initialSelectedTopics changes
  useEffect(() => {
    setSelectedTopics(new Set(initialSelectedTopics));
  }, [initialSelectedTopics]);

  // Fetch topics data
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const data = await fetchTopicsTree();
        if (data && data.length > 0) {
          setTopics(data);
        } else {
          throw new Error('No topics returned');
        }
      } catch (error) {
        console.warn('Using fallback seed data:', error);
        setTopics(SEED_TOPICS);
      } finally {
        setLoading(false);
      }
    };

    loadTopics();
  }, []);

  // Organize topics by level and parent
  const { macroTopics, subTopics, microTopics } = useMemo(() => {
    // Show all level 1 topics from database
    const macro = topics.filter(t => t.level === 1);
    const sub = topics.filter(t => t.level === 2);
    const micro = topics.filter(t => t.level === 3);

    return {
      macroTopics: macro,
      subTopics: sub,
      microTopics: micro
    };
  }, [topics]);

  // Get filtered subtopics based on selected macros
  const filteredSubTopics = useMemo(() => {
    const selectedMacros = Array.from(selectedTopics).filter(id => 
      macroTopics.some(m => m.id === id)
    );
    
    if (selectedMacros.length === 0) return [];
    
    return subTopics.filter(sub => 
      selectedMacros.includes(sub.parent_id!)
    );
  }, [selectedTopics, macroTopics, subTopics]);

  // Get filtered micro topics based on selected subs (or sub-topics of selected macros)
  const filteredMicroTopics = useMemo(() => {
    const selectedSubs = Array.from(selectedTopics).filter(id => 
      subTopics.some(s => s.id === id)
    );
    
    let availableMicros: Topic[] = [];
    
    if (selectedSubs.length > 0) {
      // Show micros for selected subs
      availableMicros = microTopics.filter(micro => 
        selectedSubs.includes(micro.parent_id!)
      );
    } else {
      // Show micros for subs of selected macros
      const selectedMacros = Array.from(selectedTopics).filter(id => 
        macroTopics.some(m => m.id === id)
      );
      const relevantSubs = subTopics.filter(sub => 
        selectedMacros.includes(sub.parent_id!)
      );
      availableMicros = microTopics.filter(micro => 
        relevantSubs.some(sub => sub.id === micro.parent_id)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      return availableMicros.filter(micro =>
        micro.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return availableMicros;
  }, [selectedTopics, macroTopics, subTopics, microTopics, searchQuery]);

  const toggleTopic = (topicId: number) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopics(newSelected);
  };

  const removeTopic = (topicId: number) => {
    const newSelected = new Set(selectedTopics);
    newSelected.delete(topicId);
    setSelectedTopics(newSelected);
  };

  const getTopicById = (id: number) => topics.find(t => t.id === id);

  const canProceedToNext = () => {
    if (currentStep === 1) {
      return Array.from(selectedTopics).some(id => macroTopics.some(m => m.id === id));
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const topicIds = Array.from(selectedTopics);
      
      // Track preferences completion
      trackPreferencesCompleted(topicIds.length);
      
      await onSave(topicIds);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const selectedMacroCount = Array.from(selectedTopics).filter(id => 
    macroTopics.some(m => m.id === id)
  ).length;
  
  const selectedSubCount = Array.from(selectedTopics).filter(id => 
    subTopics.some(s => s.id === id)
  ).length;
  
  const selectedMicroCount = Array.from(selectedTopics).filter(id => 
    microTopics.some(m => m.id === id)
  ).length;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Choose Your Interests</h1>
            <p className="text-muted-foreground">
              Step {currentStep} of 3: {currentStep === 1 ? 'Select broad categories' : currentStep === 2 ? 'Choose subtopics' : 'Pick specific interests'}
            </p>
            <Progress value={(currentStep / 3) * 100} className="mt-4" />
          </div>

          {/* Step 1: Macro Topics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Main Categories</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {macroTopics.map(topic => (
                  <Card
                    key={topic.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedTopics.has(topic.id) 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => toggleTopic(topic.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{topic.label}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Sub Topics */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold">Subtopics</h2>
              {Array.from(selectedTopics).filter(id => macroTopics.some(m => m.id === id)).length === 0 ? (
                <p className="text-muted-foreground">Please select some main categories first.</p>
              ) : filteredSubTopics.length === 0 ? (
                <p className="text-muted-foreground">No subtopics available for your selected categories.</p>
              ) : (
                <div className="space-y-8">
                  {macroTopics
                    .filter(macro => selectedTopics.has(macro.id))
                    .map(macro => {
                      const macroSubs = filteredSubTopics.filter(sub => sub.parent_id === macro.id);
                      if (macroSubs.length === 0) return null;
                      return (
                        <div key={macro.id} className="space-y-4">
                          {/* Category Header */}
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <h3 className="text-xl font-semibold text-primary">{macro.label}</h3>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="text-muted-foreground">
                              {macroSubs.length} subtopics
                            </Badge>
                          </div>
                          
                          {/* Subtopics Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {macroSubs.map(sub => (
                              <div
                                key={sub.id}
                                className="cursor-pointer transition-all"
                                onClick={() => toggleTopic(sub.id)}
                              >
                                <TopicCard
                                  to="#"
                                  label={sub.label}
                                  level={sub.level}
                                  selected={selectedTopics.has(sub.id)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Micro Topics */}
          {currentStep === 3 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Specific Interests</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search specific topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {filteredMicroTopics.length === 0 ? (
                <p className="text-muted-foreground">
                  {searchQuery ? 'No topics match your search.' : 'No specific topics available for your selection.'}
                </p>
              ) : (
                <div className="space-y-8">
                  {/* Group micro topics by their parent subtopic or category */}
                  {(() => {
                    const selectedSubs = Array.from(selectedTopics).filter(id => 
                      subTopics.some(s => s.id === id)
                    );
                    
                    if (selectedSubs.length > 0) {
                      // Group by selected subtopics
                      return selectedSubs.map(subId => {
                        const subtopic = subTopics.find(s => s.id === subId);
                        const parentMacro = macroTopics.find(m => m.id === subtopic?.parent_id);
                        const subMicros = filteredMicroTopics.filter(micro => micro.parent_id === subId);
                        
                        if (!subtopic || !parentMacro || subMicros.length === 0) return null;
                        
                        return (
                          <div key={subId} className="space-y-4">
                            {/* Breadcrumb Header */}
                            <div className="flex items-center gap-2 pb-2 border-b">
                              <span className="text-lg font-medium text-muted-foreground">{parentMacro.label}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span className="text-lg font-semibold text-primary">{subtopic.label}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline" className="text-muted-foreground">
                                {subMicros.length} interests
                              </Badge>
                            </div>
                            
                            {/* Micro Topics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {subMicros.map(micro => (
                                <div
                                  key={micro.id}
                                  className="cursor-pointer transition-all"
                                  onClick={() => toggleTopic(micro.id)}
                                >
                                  <TopicCard
                                    to="#"
                                    label={micro.label}
                                    level={micro.level}
                                    selected={selectedTopics.has(micro.id)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }).filter(Boolean);
                    } else {
                      // Group by selected categories (show all subtopics' micros)
                      const selectedMacros = Array.from(selectedTopics).filter(id => 
                        macroTopics.some(m => m.id === id)
                      );
                      
                      return selectedMacros.map(macroId => {
                        const macro = macroTopics.find(m => m.id === macroId);
                        const macroMicros = filteredMicroTopics.filter(micro => {
                          const microSub = subTopics.find(s => s.id === micro.parent_id);
                          return microSub?.parent_id === macroId;
                        });
                        
                        if (!macro || macroMicros.length === 0) return null;
                        
                        return (
                          <div key={macroId} className="space-y-4">
                            {/* Category Header */}
                            <div className="flex items-center gap-2 pb-2 border-b">
                              <span className="text-lg font-semibold text-primary">{macro.label}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline" className="text-muted-foreground">
                                {macroMicros.length} interests
                              </Badge>
                            </div>
                            
                            {/* Micro Topics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {macroMicros.map(micro => (
                                <div
                                  key={micro.id}
                                  className={`cursor-pointer transition-all ${
                                    selectedTopics.has(micro.id) ? 'ring-2 ring-primary' : ''
                                  }`}
                                  onClick={() => toggleTopic(micro.id)}
                                >
                                  <TopicCard
                                    to="#"
                                    label={micro.label}
                                    level={micro.level}
                                    className={selectedTopics.has(micro.id) ? 'bg-primary/5' : ''}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }).filter(Boolean);
                    }
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            {currentStep < 3 ? (
              <Button 
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceedToNext()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={onSaveAll || handleSave}
                disabled={saving || selectedTopics.size === 0}
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Your Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Counters */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Categories:</span>
                  <span className="font-medium">{selectedMacroCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtopics:</span>
                  <span className="font-medium">{selectedSubCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Specific:</span>
                  <span className="font-medium">{selectedMicroCount}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{selectedTopics.size}</span>
                </div>
              </div>

              {/* Selected Topics */}
              {selectedTopics.size > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Selected Topics:</h4>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {Array.from(selectedTopics).map(topicId => {
                      const topic = getTopicById(topicId);
                      if (!topic) return null;
                      return (
                        <div
                          key={topicId}
                          className="flex items-center justify-between text-xs bg-accent/20 rounded px-2 py-1"
                        >
                          <span className="truncate">{topic.label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => removeTopic(topicId)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};