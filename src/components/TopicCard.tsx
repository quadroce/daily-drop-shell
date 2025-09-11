import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type TopicCardProps = {
  to: string;
  label: string;
  intro?: string | null;
  level: number;
  className?: string;
};

export const TopicCard = ({ to, label, intro, level, className }: TopicCardProps) => {
  const levelColors = {
    1: "bg-primary text-primary-foreground",
    2: "bg-secondary text-secondary-foreground", 
    3: "bg-muted text-muted-foreground"
  };

  return (
    <Link to={to} className={className}>
      <Card className="h-full hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold leading-tight">
              {label}
            </CardTitle>
            <Badge variant="outline" className={levelColors[level as keyof typeof levelColors]}>
              L{level}
            </Badge>
          </div>
        </CardHeader>
        {intro && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {intro}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  );
};