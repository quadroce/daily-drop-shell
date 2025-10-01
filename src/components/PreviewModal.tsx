import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";

type Drop = {
  id: number;
  title: string;
  summary: string | null;
  url: string;
};

type PreviewModalProps = {
  drop: Drop | null;
  open: boolean;
  onClose: () => void;
};

export const PreviewModal = ({ drop, open, onClose }: PreviewModalProps) => {
  if (!drop) return null;

  const getExcerpt = (summary: string | null) => {
    if (!summary) return "Sign up to read the full article and access our entire content library.";
    
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const excerpt = sentences.slice(0, 2).join('. ');
    return excerpt.length > 200 ? excerpt.substring(0, 200) + '...' : excerpt + '.';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Premium Content</span>
          </div>
          <DialogTitle className="text-2xl font-bold leading-tight pr-8">
            {drop.title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-4 leading-relaxed">
            {getExcerpt(drop.summary)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6 p-6 bg-muted/50 rounded-xl">
          <p className="text-sm text-muted-foreground mb-4">
            Create a free account to continue reading this article and get access to our entire curated content library.
          </p>
          <Button size="lg" className="w-full rounded-xl" asChild>
            <Link to="/auth" onClick={onClose}>
              Continue reading
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
