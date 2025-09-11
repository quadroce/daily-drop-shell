import { FeedCard, FeedCardProps } from "./FeedCard";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export type TopicFeedPreviewProps = {
  items: FeedCardProps[];
  minYoutube?: 1;
  slug: string;
};

export const TopicFeedPreview = ({ items, slug }: TopicFeedPreviewProps) => {
  return (
    <section className="py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Latest Updates</h2>
          <Link 
            to={`/topics/${slug}/archive`}
            className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
          >
            See full archive
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-6">
          {items.map((item) => (
            <FeedCard key={item.id} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};