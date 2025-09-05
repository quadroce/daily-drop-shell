import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { fetchTopicsTree } from "@/lib/api/topics";

interface Topic {
  id: number;
  slug: string;
  label: string;
  level: 1 | 2 | 3;
  parent_id: number | null;
}

interface TopicsOnboardingWizardProps {
  onSave: (topicIds: number[]) => Promise<void>;
}

// Fallback seed data
const SEED_TOPICS: Topic[] = [
  // Macro topics (level 1)
  { id: 1, slug: "technology", label: "Technology", level: 1, parent_id: null },
  { id: 2, slug: "business", label: "Business", level: 1, parent_id: null },
  { id: 3, slug: "science", label: "Science", level: 1, parent_id: null },
  { id: 4, slug: "health", label: "Health", level: 1, parent_id: null },
  
  // Sub topics (level 2)
  { id: 5, slug: "ai-ml", label: "AI & Machine Learning", level: 2, parent_id: 1 },
  { id: 6, slug: "web-dev", label: "Web Development", level: 2, parent_id: 1 },
  { id: 7, slug: "fintech", label: "FinTech", level: 2, parent_id: 2 },
  { id: 8, slug: "biotech", label: "Biotechnology", level: 2, parent_id: 3 },
  
  // Micro topics (level 3)
  { id: 9, slug: "chatgpt", label: "ChatGPT", level: 3, parent_id: 5 },
  { id: 10, slug: "react", label: "React", level: 3, parent_id: 6 },
  { id: 11, slug: "crypto", label: "Cryptocurrency", level: 3, parent_id: 7 },
  { id: 12, slug: "gene-therapy", label: "Gene Therapy", level: 3, parent_id: 8 },
];

export const TopicsOnboardingWizard: React.FC<TopicsOnboardingWizardProps> = ({
  onSave
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      await onSave(Array.from(selectedTopics));
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
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Subtopics</h2>
              {Array.from(selectedTopics).filter(id => macroTopics.some(m => m.id === id)).length === 0 ? (
                <p className="text-muted-foreground">Please select some main categories first.</p>
              ) : filteredSubTopics.length === 0 ? (
                <p className="text-muted-foreground">No subtopics available for your selected categories.</p>
              ) : (
                <Accordion type="multiple" className="space-y-4">
                  {macroTopics
                    .filter(macro => selectedTopics.has(macro.id))
                    .map(macro => {
                      const macroSubs = filteredSubTopics.filter(sub => sub.parent_id === macro.id);
                      return (
                        <AccordionItem key={macro.id} value={macro.id.toString()}>
                          <AccordionTrigger className="text-lg font-medium">
                            {macro.label} ({macroSubs.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {macroSubs.map(sub => (
                                <Badge
                                  key={sub.id}
                                  variant={selectedTopics.has(sub.id) ? "default" : "outline"}
                                  className="cursor-pointer hover:bg-primary/20"
                                  onClick={() => toggleTopic(sub.id)}
                                >
                                  {sub.label}
                                </Badge>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                </Accordion>
              )}
            </div>
          )}

          {/* Step 3: Micro Topics */}
          {currentStep === 3 && (
            <div className="space-y-6">
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
              <div className="flex flex-wrap gap-2">
                {filteredMicroTopics.map(micro => (
                  <Badge
                    key={micro.id}
                    variant={selectedTopics.has(micro.id) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/20 text-sm py-1 px-3"
                    onClick={() => toggleTopic(micro.id)}
                  >
                    {micro.label}
                  </Badge>
                ))}
              </div>
              {filteredMicroTopics.length === 0 && (
                <p className="text-muted-foreground">
                  {searchQuery ? 'No topics match your search.' : 'No specific topics available for your selection.'}
                </p>
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
                onClick={handleSave}
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