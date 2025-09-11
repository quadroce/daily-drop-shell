import { Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImagePlaceholderProps {
  className?: string;
  showIcon?: boolean;
  text?: string;
}

export const ImagePlaceholder = ({ 
  className, 
  showIcon = true,
  text = "No image available" 
}: ImagePlaceholderProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center bg-muted/50 border-2 border-dashed border-muted-foreground/20 rounded-lg",
      className
    )}>
      {showIcon && (
        <Droplets className="h-8 w-8 text-muted-foreground/40 mb-2" />
      )}
      <span className="text-xs text-muted-foreground/60 font-medium">
        {text}
      </span>
    </div>
  );
};