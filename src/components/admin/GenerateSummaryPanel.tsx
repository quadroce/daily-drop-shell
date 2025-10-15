import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { generateDailyTopicSummary } from "@/lib/api/dailySummaries";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const GenerateSummaryPanel = () => {
  const [topicSlug, setTopicSlug] = useState("time-management");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);

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
          disabled={isGenerating}
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
              Generate Summary
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Summary will be generated using OpenAI GPT-4o-mini</p>
          <p>• Results are saved to the database automatically</p>
          <p>• Existing summaries will be updated</p>
        </div>
      </CardContent>
    </Card>
  );
};