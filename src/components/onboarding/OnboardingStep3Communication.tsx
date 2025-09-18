import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { ChannelToggleList } from "@/components/communication/ChannelToggleList";

interface OnboardingStep3Props {
  communicationPrefs: { [key: string]: boolean };
  onCommunicationChange: (prefs: { [key: string]: boolean }) => void;
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingStep3Communication: React.FC<OnboardingStep3Props> = ({
  communicationPrefs,
  onCommunicationChange,
  onNext,
  onBack
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Communication Preferences
        </h2>
        <p className="text-muted-foreground">
          Choose how you'd like to receive your personalized content updates
        </p>
      </div>

      {/* Channel Toggle List */}
      <ChannelToggleList 
        location="onboarding" 
        onChannelsChange={onCommunicationChange}
      />

      {/* Action Buttons */}
      <div className="flex justify-between pt-6">
        <Button 
          variant="outline" 
          onClick={onBack}
        >
          Back
        </Button>
        <Button 
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};