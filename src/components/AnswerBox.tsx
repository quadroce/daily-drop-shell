import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type AnswerBoxProps = {
  question: string;
  answer: string;
  category?: string;
  lastUpdated?: string;
};

export const AnswerBox = ({ question, answer, category, lastUpdated }: AnswerBoxProps) => {
  const wordCount = answer.split(' ').length;
  const isOptimalLength = wordCount >= 40 && wordCount <= 70;

  return (
    <Card className="p-6 border-l-4 border-l-primary bg-background/50 backdrop-blur-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground leading-tight">
            {question}
          </h3>
          {category && (
            <Badge variant="secondary" className="shrink-0">
              {category}
            </Badge>
          )}
        </div>
        
        <div className="prose prose-sm max-w-none">
          <p className={`text-muted-foreground leading-relaxed ${!isOptimalLength ? 'opacity-90' : ''}`}>
            {answer}
          </p>
        </div>

        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Updated {lastUpdated}</span>
            <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
            <span>{wordCount} words</span>
          </div>
        )}
      </div>
    </Card>
  );
};