import { Badge } from "@/components/ui/badge";

export type TopicIntroProps = {
  title: string;
  introHtml: string;
  slug: string;
};

export const TopicIntro = ({ title, introHtml, slug }: TopicIntroProps) => {
  return (
    <section className="py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-4xl font-bold text-foreground">{title}</h1>
          <Badge variant="outline" className="text-muted-foreground">
            {slug}
          </Badge>
        </div>
        <div 
          className="prose prose-lg max-w-none text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: introHtml }}
        />
      </div>
    </section>
  );
};