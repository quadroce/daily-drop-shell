import { Badge } from "@/components/ui/badge";
import { ContentTimestamp } from "@/components/ContentTimestamp";

export type TopicIntroProps = {
  title: string;
  introHtml: string;
  slug: string;
  updatedAt?: Date | string;
};

export const TopicIntro = ({ title, introHtml, slug, updatedAt }: TopicIntroProps) => {
  return (
    <section className="py-8 px-4" role="banner">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">{title}</h1>
            <Badge variant="outline" className="text-muted-foreground">
              {slug}
            </Badge>
          </div>
          {updatedAt && (
            <ContentTimestamp updatedAt={updatedAt} className="hidden sm:flex" />
          )}
        </div>
        <article 
          className="prose prose-lg max-w-none text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: introHtml }}
        />
        {updatedAt && (
          <ContentTimestamp updatedAt={updatedAt} className="mt-4 sm:hidden" />
        )}
      </div>
    </section>
  );
};