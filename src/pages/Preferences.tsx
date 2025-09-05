import React from "react";
import { TopicsOnboardingWizard } from "@/components/TopicsOnboardingWizard";
import { saveUserTopics } from "@/lib/api/topics";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const Preferences = () => {
  const navigate = useNavigate();

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

  return (
    <TopicsOnboardingWizard
      fetchUrl="/api/topics/tree"
      onSave={handleSaveTopics}
    />
  );
};

export default Preferences;