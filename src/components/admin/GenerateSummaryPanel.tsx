import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { generateDailyTopicSummary } from "@/lib/api/dailySummaries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Zap } from "lucide-react";

export const GenerateSummaryPanel = () => {
  const [topicSlug, setTopicSlug] = useState("time-management");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topicSlug || !date) {
      toast.error("Please provide both topic slug and date");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateDailyTopicSummary(topicSlug, date);
      
      if (result.success) {
        toast.success(`Summary generated successfully for ${topicSlug} on ${date}`);
      } else {
        toast.error(result.error || "Failed to generate summary");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchGenerate = async () => {
    setIsBatchGenerating(true);
    
    try {
      toast.info("Starting batch generation for all missing summaries...");
      
      const { data, error } = await supabase.functions.invoke('generate-daily-summaries-batch');
      
      if (error) throw error;
      
      toast.success(
        `Batch generation complete! Generated: ${data.generated}, Skipped: ${data.skipped}`,
        { duration: 5000 }
      );
      
      if (data.errors && data.errors.length > 0) {
        console.error("Batch generation errors:", data.errors);
      }
    } catch (error) {
      console.error("Error in batch generation:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate batch summaries");
    } finally {
      setIsBatchGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Generate Daily Topic Summary
        </CardTitle>
        <CardDescription>
          Generate AI-powered summaries for topic archive pages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic-slug">Topic Slug</Label>
          <Input
            id="topic-slug"
            placeholder="e.g., time-management"
            value={topicSlug}
            onChange={(e) => setTopicSlug(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || isBatchGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Single Summary
            </>
          )}
        </Button>

        <div className="border-t pt-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-1">Batch Generation</h4>
            <p className="text-xs text-muted-foreground">
              Generate all missing summaries for the last 7 days
            </p>
          </div>
          
          <Button 
            onClick={handleBatchGenerate} 
            disabled={isGenerating || isBatchGenerating}
            variant="secondary"
            className="w-full"
          >
            {isBatchGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Batch...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate All Missing Summaries
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Summary will be generated using OpenAI GPT-4o-mini</p>
          <p>• Results are saved to the database automatically</p>
          <p>• Existing summaries will be updated</p>
        </div>
      </CardContent>
    </Card>
  );
};