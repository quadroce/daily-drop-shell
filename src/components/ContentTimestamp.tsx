import { format } from "date-fns";

export type ContentTimestampProps = {
  updatedAt: Date | string;
  className?: string;
  showIcon?: boolean;
};

export const ContentTimestamp = ({ 
  updatedAt, 
  className = "", 
  showIcon = true 
}: ContentTimestampProps) => {
  const date = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const formattedDate = format(date, 'yyyy-MM-dd');
  
  return (
    <div className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}>
      {showIcon && (
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="shrink-0"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
        </svg>
      )}
      <span>Updated {formattedDate}</span>
    </div>
  );
};