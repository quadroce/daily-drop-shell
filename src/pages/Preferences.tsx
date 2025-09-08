import React, { useState, useEffect } from "react";
import { TopicsOnboardingWizard } from "@/components/TopicsOnboardingWizard";
import { saveUserTopics, fetchUserPreferences } from "@/lib/api/topics";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const Preferences = () => {
  const navigate = useNavigate();
  const [initialTopics, setInitialTopics] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExistingPreferences = async () => {
      try {
        const preferences = await fetchUserPreferences();
        if (preferences) {
          setInitialTopics(preferences.selectedTopicIds);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    loadExistingPreferences();
  }, []);

  const handleSaveTopics = async (topicIds: number[]) => {
    try {
      await saveUserTopics(topicIds);
      
      toast({
        title: "Success",
        description: "Your preferences have been saved!",
      });

      navigate("/feed");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to let the wizard handle the error state
    }
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <TopicsOnboardingWizard
      onSave={handleSaveTopics}
      initialSelectedTopics={initialTopics}
    />
  );
};

export default Preferences;