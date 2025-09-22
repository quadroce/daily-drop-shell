import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useOnboardingError } from "@/hooks/useOnboardingError";
import { toast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { saveProfile, saveTopics, markOnboardingComplete, OnboardingProfile } from "@/lib/api/profile";
import { clearOnboardingState } from "@/lib/api/onboarding";
import { fetchTopicsTree } from "@/lib/api/topics";
import { OnboardingStep1Profile } from "@/components/onboarding/OnboardingStep1Profile";
import { OnboardingStep2Preferences } from "@/components/onboarding/OnboardingStep2Preferences";
import { OnboardingStep3Communication } from "@/components/onboarding/OnboardingStep3Communication";
import { OnboardingStep4Topics } from "@/components/onboarding/OnboardingStep4Topics";
import { OnboardingStep5Review } from "@/components/onboarding/OnboardingStep5Review";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RotateCcw } from "lucide-react";

interface Topic {
  id: number;
  slug: string;
  label: string;
  level: 1 | 2 | 3;
  parent_id: number | null;
}

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Enhanced state management with auto-save and recovery
  const { 
    state: onboardingState, 
    setStep,
    updateData,
    completeOnboarding
  } = useOnboardingState();
  
  // Enhanced error handling
  const { 
    error: operationError, 
    retryCount, 
    isRetrying, 
    handleError, 
    retry, 
    clearError 
  } = useOnboardingError();

  // Derived state from onboarding state
  const currentStep = onboardingState.current_step;
  const formData = onboardingState.profile_data || {};
  const selectedTopics = onboardingState.selected_topics || [];
  const communicationPrefs = onboardingState.communication_prefs || {};

  // Load topics and prefill from OAuth if available
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const fetchedTopics = await fetchTopicsTree();
        setTopics(fetchedTopics);
      } catch (error) {
        console.error('Error loading topics:', error);
      }
    };

    loadTopics();

    // Prefill from OAuth metadata if available
    if (user?.user_metadata) {
      const metadata = user.user_metadata;
      const newProfileData = {
        ...formData,
        first_name: metadata.first_name || metadata.given_name || formData.first_name || '',
        last_name: metadata.last_name || metadata.family_name || formData.last_name || '',
      };
      updateData({ profile_data: newProfileData });
    }
  }, [user]);

  // Track onboarding start
  useEffect(() => {
    track('onboarding_start', { step: 'start' });
  }, []);

  const topicLabels = useMemo(() => {
    const labels: { [key: number]: string } = {};
    topics.forEach(topic => {
      labels[topic.id] = topic.label;
    });
    return labels;
  }, [topics]);

  const handleFormChange = (field: string, value: any) => {
    const newProfileData = {
      ...formData,
      [field]: value
    };
    
    // Auto-save the change
    updateData({ profile_data: newProfileData });
  };

  const handleNext = () => {
    if (currentStep < 5) {
      const nextStep = currentStep + 1;
      
      // Track step completion
      switch (currentStep) {
        case 1:
          track('onboarding_profile_submitted', { 
            role_present: !!formData.company_role 
          });
          break;
        case 2:
          track('onboarding_languages_set', { 
            count: formData.language_prefs?.length || 0,
            languages: formData.language_prefs || [] 
          });
          track('onboarding_embed_pref_set', { 
            youtube_embed_pref: formData.youtube_embed_pref 
          });
          break;
        case 3:
          // Communication step completed - tracking is handled by the component
          break;
        case 4:
          const l1Count = selectedTopics.filter(id => {
            const topic = topics.find(t => t.id === id);
            return topic?.level === 1;
          }).length;
          const l2Count = selectedTopics.filter(id => {
            const topic = topics.find(t => t.id === id);
            return topic?.level === 2;
          }).length;
          const l3Count = selectedTopics.filter(id => {
            const topic = topics.find(t => t.id === id);
            return topic?.level === 3;
          }).length;
          
          track('onboarding_topics_confirmed', {
            l1: l1Count,
            l2: l2Count,
            l3: l3Count,
            total: selectedTopics.length
          });
          break;
      }
      
      // Auto-save the step progression
      setStep(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setStep(prevStep);
    }
  };

  const handleTopicsChange = (topics: number[]) => {
    updateData({ selected_topics: topics });
  };

  const handleCommunicationChange = (prefs: { [key: string]: boolean }) => {
    updateData({ communication_prefs: prefs });
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await completeOnboarding();
      toast({
        title: "Welcome to DailyDrops! 🎉",
        description: "Your account has been set up successfully.",
      });
      
      // Fallback redirect in case completeOnboarding doesn't navigate
      setTimeout(() => {
        navigate('/feed', { replace: true });
      }, 1000);
      
    } catch (error) {
      console.error('Error completing onboarding:', error);
      
      // Try to mark onboarding as complete and redirect anyway
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes?.user) {
          await supabase
            .from("profiles")
            .update({ onboarding_completed: true })
            .eq("id", userRes.user.id);
          
          toast({
            title: "Setup Complete! 🎉", 
            description: "Some preferences may need to be set manually in settings.",
          });
          
          navigate('/feed', { replace: true });
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback completion failed:', fallbackError);
      }
      
      toast({
        title: "Error",
        description: "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
      setIsCompleting(false);
    }
  };

  const handleRestart = async () => {
    try {
      updateData({ 
        current_step: 1, 
        selected_topics: [], 
        profile_data: {}, 
        communication_prefs: {} 
      });
      toast({
        title: "Onboarding Reset",
        description: "Starting fresh from the beginning.",
      });
    } catch (error) {
      console.error('Error restarting onboarding:', error);
    }
  };

  const progressValue = (currentStep / 5) * 100;

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!onboardingState.loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to DailyDrops
            </h1>
            {onboardingState.dirty && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground mb-6">
            Let's personalize your content experience in just a few steps
          </p>
          
          {/* Progress Bar */}
          <div className="max-w-md mx-auto">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentStep} of 5</span>
              <span>{Math.round(progressValue)}% complete</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>

        </div>

        {/* Step Content */}
        <div className="flex justify-center">
          {currentStep === 1 && (
            <OnboardingStep1Profile
              formData={formData}
              onChange={handleFormChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {currentStep === 2 && (
            <OnboardingStep2Preferences
              formData={{
                language_prefs: formData.language_prefs,
                youtube_embed_pref: formData.youtube_embed_pref
              }}
              onChange={handleFormChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {currentStep === 3 && (
            <OnboardingStep3Communication
              communicationPrefs={communicationPrefs}
              onCommunicationChange={handleCommunicationChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {currentStep === 4 && (
            <OnboardingStep4Topics
              selectedTopics={selectedTopics}
              onTopicsChange={handleTopicsChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {currentStep === 5 && (
            <OnboardingStep5Review
              formData={formData}
              selectedTopics={selectedTopics}
              topicLabels={topicLabels}
              onComplete={handleComplete}
              onBack={handleBack}
              isCompleting={isCompleting}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;