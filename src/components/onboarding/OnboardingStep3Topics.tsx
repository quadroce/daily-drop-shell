import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, AlertCircle } from "lucide-react";
import { TopicsOnboardingWizard } from "@/components/TopicsOnboardingWizard";

interface OnboardingStep3Props {
  selectedTopics: number[];
  onTopicsChange: (topics: number[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingStep3Topics: React.FC<OnboardingStep3Props> = ({
  selectedTopics,
  onTopicsChange,
  onNext,
  onBack
}) => {
  const hasMinTopics = selectedTopics.length >= 1;
  const isAtMaxTopics = selectedTopics.length >= 15;

  const handleSaveTopics = async (topicIds: number[]) => {
    onTopicsChange(topicIds);
    onNext();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Choose Your Topics
          </CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              Topics are organized as a tree (Level 1 → Level 2 → Level 3). You can select up to 15 total topics.
            </p>
            <Badge variant={isAtMaxTopics ? "destructive" : "outline"}>
              {selectedTopics.length}/15 selected
            </Badge>
          </div>
          
          {!hasMinTopics && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Please select at least 1 topic to continue</p>
            </div>
          )}
        </CardHeader>
      </Card>

      <TopicsOnboardingWizard
        onSave={handleSaveTopics}
        initialSelectedTopics={selectedTopics}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button 
              onClick={onNext}
              disabled={!hasMinTopics}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};