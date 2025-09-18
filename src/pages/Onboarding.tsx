import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { saveProfile, saveTopics, markOnboardingComplete, OnboardingProfile } from "@/lib/api/profile";
import { fetchTopicsTree } from "@/lib/api/topics";
import { OnboardingStep1Profile } from "@/components/onboarding/OnboardingStep1Profile";
import { OnboardingStep2Preferences } from "@/components/onboarding/OnboardingStep2Preferences";
import { OnboardingStep3Communication } from "@/components/onboarding/OnboardingStep3Communication";
import { OnboardingStep4Topics } from "@/components/onboarding/OnboardingStep4Topics";
import { OnboardingStep5Review } from "@/components/onboarding/OnboardingStep5Review";

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
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Form data state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_role: '',
    language_prefs: ['en'] as string[], // Default to English
    youtube_embed_pref: true,
  });

  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);

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
      setFormData(prev => ({
        ...prev,
        first_name: metadata.first_name || metadata.given_name || prev.first_name,
        last_name: metadata.last_name || metadata.family_name || prev.last_name,
      }));
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
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
      
      // Track step completion
      switch (currentStep) {
        case 1:
          track('onboarding_profile_submitted', { 
            role_present: !!formData.company_role 
          });
          break;
        case 2:
          track('onboarding_languages_set', { 
            count: formData.language_prefs.length,
            languages: formData.language_prefs 
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
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    
    try {
      // Save profile data
      const profileData: OnboardingProfile = {
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        company_role: formData.company_role || undefined,
        language_prefs: formData.language_prefs,
        youtube_embed_pref: formData.youtube_embed_pref,
      };
      
      await saveProfile(profileData);
      
      // Save topic preferences
      if (selectedTopics.length > 0) {
        await saveTopics(selectedTopics);
      }
      
      // Mark onboarding as complete
      await markOnboardingComplete();
      
      // Track completion
      track('onboarding_completed', {
        total_topics: selectedTopics.length
      });
      
      toast({
        title: "Welcome to DailyDrops! 🎉",
        description: "Your account has been set up successfully.",
      });
      
      navigate('/feed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const progressValue = (currentStep / 5) * 100;

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to DailyDrops
          </h1>
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
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          
          {currentStep === 4 && (
            <OnboardingStep4Topics
              selectedTopics={selectedTopics}
              onTopicsChange={setSelectedTopics}
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